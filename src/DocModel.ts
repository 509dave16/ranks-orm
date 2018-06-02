import objectEqual from "fast-deep-equal";
import objectClone from "fast-clone";
import {RanksMediator} from "./RanksMediator";
import {RanksDB} from "./namespaces/RanksDB.namespace";
import DocRelationDescriptor = RanksDB.DocRelationDescriptor;
import TypeSchema = RanksDB.TypeSchema;
import SaveOptions = RanksDB.SaveOptions;
import t from 'tcomb';
import _ from 'lodash';
import ParsedDocId = RanksDB.ParsedDocId;
import DataDescriptor = DataRelationsNamespace.DataDescriptor;
import {DataRelationsNamespace} from "./namespaces/DataRelations.namespace";

function ModelProxy<T extends { new(...args: any[]): {} }>(): any {
  type Constructor = new (...args: any[]) => T;
  return (target: T): Constructor => {
    // Save a reference to the original constructor
    const DocModelConstructor = target;
    // the new constructor behaviour
    const DecoratedDocModelConstructor: any = function (...args: any[]): T {
      DocModelConstructor.apply(this, args);
      const blacklistedProps = ['then', 'catch'];
      var handler = {
        get: function(obj, prop) {
            if (prop in obj) {
              return obj[prop];
            } else if(blacklistedProps.indexOf(prop) === -1) {
              return  obj.getField(prop);
            } else {
              return;
            }
        },
        set: function (obj, prop, value) {
          return prop in obj ?
            obj[prop] = value :
            obj.setField(prop, value);
        }
      };
      return new Proxy(this, handler) as T;
    };
    // Copy prototype so intanceof operator still works
    DecoratedDocModelConstructor.prototype = DocModelConstructor.prototype;
    // Copy static members too
    Object.keys(DocModelConstructor).forEach((name: string) => { DecoratedDocModelConstructor[name] = (<any>DocModelConstructor)[name]; });

    // Return new constructor (will override original)
    return DecoratedDocModelConstructor;
  };
}

@ModelProxy()
export class DocModel implements DataDescriptor {
  private doc: any;
  private originalDoc: any;
  public type: string;
  private mediator: RanksMediator;
  private typeSchema: TypeSchema;

  private relationDesc: DocRelationDescriptor;
  constructor(doc: any, type: string, mediator: RanksMediator) {
    this.errorOnInvalid();
    this.type = type;
    this.mediator = mediator;
    this.typeSchema = this.mediator.getTypeSchema(this.type);
    this.originalDoc = doc;
    this.doc = objectClone(doc);
  }

  setRelationDescriptor(relationDesc: DocRelationDescriptor) {
    this.relationDesc = relationDesc;
  }

  get id(): number {
    return this.doc.id;
  }

  getDoc(): any {
    return this.doc;
  }

  setDoc(doc: any) {
    this.doc = doc;
  }

  refreshOriginalDoc() {
    this.originalDoc = objectClone(this.doc);
  }

  hasChanged(): boolean {
    return this.isNew() || !objectEqual(this.doc, this.originalDoc);
  }

  async get (relation: string) {
    return this.mediator.getRelation(this, relation);
  }

  attach(relation: string, modelOrDoc: DocModel|any, inverseRelation?: string): Promise<DocModel> {
    return this.mediator.attachToRelation(this, relation, modelOrDoc, inverseRelation) as Promise<DocModel>;
  }

  detach(relation: string, modelOrId: DocModel|number, inverseRelation?: string): Promise<DocModel> {
    return this.mediator.detachFromRelation(this, relation, modelOrId, inverseRelation) as Promise<DocModel>;
  }

  getField(field: string): any {
    if (!this.hasField(field)) {
      console.log(`${field} does not exist on DocModel of type ${this.type}`);
      return;
    }
    if (this.doc[field] === undefined) {
      return this.doc[field] = this.typeSchema.props[field].default();
    }
    return this.doc[field];
  }

  setField(field: string, value: any): DocModel {
    this.errorOnFieldNotExist(field);
    this.errorOnValueTypeConflict(field, value);
    this.doc[field] = value;
    return this;
  }

  addToField(field: string, value: any): DocModel {
    this.errorOnFieldNotExist(field);
    // this.errorOnFieldNotArray(field);
    this.errorOnValueElementTypeConflict(field, value);
    const ara = this.getField(field) as any[];
    ara.push(value);
   return this;
  }

  errorOnFieldNotArray(field: string) {
    if (!this.fieldIsArray(field)) {
      throw new Error(`Field ${field} is not of type Array.`);
    }
  }

  errorOnFieldNotExist(field: string) {
    if (!this.hasField(field)) {
      throw new Error(`Field ${field} does not exist on type.`);
    }
  }

  errorOnValueTypeConflict(field, value) {
    this.typeSchema.props[field].type.is(value);
  }

  errorOnValueElementTypeConflict(field, value) {
    this.typeSchema.props[field].elementType.is(value);
  }

  errorOnInvalid() {
    if (!this.isValid()) {
      throw new Error('Doc is invalid');
    }
  }

  hasField(field: string): boolean {
    return this.typeSchema.props[field] !== undefined;
  }

  fieldIsArray(field: string): boolean {
    return this.typeSchema.props[field].type === t.Array;
  }

  invalidFieldValue(field: string, value: any): boolean|string {
    try {
      this.errorOnValueTypeConflict(field, value);
    } catch (e) {
      return e.message;
    }
    return false;
  }

  isValid(): boolean {
    return this.validate().length === 0;
  }

  validate(): string[] {
    const errors: string[] = [];
    for(const field in this.doc) {
      const value = this.doc[field];
      const reason = this.invalidFieldValue(field, value);
      if (reason !== false) {
        errors.push(reason as string);
      }
    }
    return errors;
  }

  isNew(): boolean {
    return this.doc['rev'] == undefined;
  }

  createDoc(): any {
    const isNewDoc: boolean = this.isNew();
    // First make sure defaults are populated
    for(const prop in this.doc) {
      const value = this.doc[prop];
      if (value === undefined) {
        this.doc[prop] = this.typeSchema.props[prop].default();
      }
    }
    // 1. Don't change models data
    const clonedDoc: any = objectClone(this.doc);
    // 2. Make a relational pouch id
    const parsedDocID: ParsedDocId = { type: this.type, id: this.id};
    const rpId: string = this.mediator.db.makeDocID(parsedDocID);
    // 3. Remove unwanted id/rev in favor of Pouch/Couch spec of _sid/_rev
    const blacklistedKeys = ['_id'];
    clonedDoc._id = rpId;
    delete clonedDoc.id;
    if (!isNewDoc) {
      clonedDoc._rev = clonedDoc.rev;
      delete clonedDoc.rev;
      blacklistedKeys.push('_rev');
    }
    // 4. Make an object with _id, _rev, and data(which is everything but _id/_rev
    const formattedDoc = _.pick(clonedDoc, blacklistedKeys);
    formattedDoc.data = _.omit(clonedDoc, blacklistedKeys);
    return formattedDoc;
  }

  save(options: SaveOptions = { refetch: false, related: false, bulk: false }): Promise<any> {
    return this.mediator.save(this, options);
  }
}
