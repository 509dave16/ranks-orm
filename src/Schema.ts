import {RelationManager} from "./relations/RelationManager";
import {RanksDB} from "./namespaces/RanksDB.namespace";
import TypeSchema = RanksDB.TypeSchema;
import {DataRelationsNamespace} from "./namespaces/DataRelations.namespace";
import DataDescriptor = DataRelationsNamespace.DataDescriptor;
import DataRelationDescriptor = DataRelationsNamespace.DataRelationDescriptor;

export class Schema {
  private typeSchemas: TypeSchema[];
  constructor(typeSchemas: TypeSchema[]) {
    this.typeSchemas = typeSchemas;
  }

  public getTypeSchemas(): TypeSchema[] {
    return this.typeSchemas;
  }

  public getTypeSchema(type: string): TypeSchema {
    return this.typeSchemas.find((typeSchema: TypeSchema) => typeSchema.plural === type || typeSchema.singular === type);
  }

  public hasRelation(type: string, relation: string) {
    return Object.keys(this.getTypeSchema(type).relations).find( typeRelation => typeRelation === relation);
  }

  public errorIfRelationDoesntExist(type: string, relation: string) {
    if (!this.hasRelation(type, relation)) {
      throw new Error(`Model does not have relation ${relation}`);
    }
  }

  /**
   * A relation has either hasMany or belongsTo on it.
   * These kes have the doc type. So publish->authors would be something like:
   * authors: { hasMany: 'users' } ( i.e. relationName.relationType.docType )
   * @param descriptor
   * @returns {string | string}
   */
  private static getDataType(descriptor) {
    return descriptor.hasMany || descriptor.belongsTo;
  }

  private static getRelationType(descriptor) {
    if (descriptor.hasMany) {
      return RelationManager.RELATION_TYPE_HAS_MANY;
    }
    if (descriptor.belongsTo) {
      return RelationManager.RELATION_TYPE_BELONGS_TO;
    }
  }

  public getRelationDescriptor(dataDescriptor: DataDescriptor, relationName): DataRelationDescriptor {
    const schema = this.getTypeSchema(dataDescriptor.type);
    const relation = schema.relations[relationName];
    if (relation == undefined) {
      throw new Error(`Relation '${relationName}' does not exist on doc of ${dataDescriptor.id} in ${dataDescriptor.type}`);
    }
    const relationDocType = Schema.getDataType(relation);
    const relationType = Schema.getRelationType(relation);
    return {
      from: dataDescriptor,
      relationName,
      relationToType: relationDocType,
      relationType
    };
  }

  public getFirstRelationOfType(typeNeedle, typeHaystack) {
    const relations = this.getTypeSchema(typeHaystack).relations;
    for(const relationName in relations) {
      const relation = relations[relationName];
      const type = Schema.getDataType(relation);
      if (type === typeNeedle) {
        return relationName;
      }
    }
    return '';
  }

  public getInverseRelationDescriptor(parentDescriptor: DataRelationDescriptor, childDescriptor: DataDescriptor, relationName: string = ''): DataRelationDescriptor {
    if (!relationName) {
      relationName = this.getFirstRelationOfType(parentDescriptor.from.type, childDescriptor.type);
    }
    if (!relationName) {
      return null; // if still empty that means there's no inverse relation. So we exit.
    }
    return this.getRelationDescriptor(childDescriptor, relationName);
  }
}
