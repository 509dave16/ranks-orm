import {RanksDB} from "./namespaces/RanksDB.namespace";
import SideloadedData = RanksDB.SideloadedData;
import {RanksMediator} from "./RanksMediator";
import {DocModel} from "./DocModel";
import ISideloadedRankModels = RanksDB.ISideloadedRankModels;
import {DocCollection} from "./DocCollection";

export class Ranks {
  public sideloadedRankModels: ISideloadedRankModels = {};
  private  mediator: RanksMediator;

  constructor(sideloadedData: SideloadedData, mediator: RanksMediator) {
    this.mediator = mediator;
    this.transformSideloadedData(sideloadedData);
  }
  private transformSideloadedData(sideloadedData: SideloadedData) {
    for (const type of Object.keys(sideloadedData))
      this.sideloadedRankModels[type] = sideloadedData[type].map(doc => new DocModel(doc, type, this.mediator));
  }

  public useExistingOrMakeNewDocModel(modelOrDoc: DocModel|any, type: string): DocModel {
    let docModel: DocModel;
    if (this.mediator.isModel(modelOrDoc)) {
      docModel = modelOrDoc as DocModel;
    } else if(modelOrDoc.id !== undefined) {
      docModel = new DocModel(modelOrDoc, type, this.mediator);
    } else if(modelOrDoc !== undefined) {
      const doc: any = modelOrDoc;
      doc.id = this.mediator.getNextDocId(type);
      docModel = new DocModel(doc, type, this.mediator)
    }
    return docModel;
  }

  public addToRanks(modelOrCollection: DocModel|DocCollection) {
    if (modelOrCollection instanceof DocCollection) {
      modelOrCollection.map((model: DocModel) => this.addDocModelToRanks(model));
      return;
    }
    this.addDocModelToRanks(modelOrCollection);
  }

  private addDocModelToRanks(model: DocModel) {
    if (this.getDocModelByTypeAndId(model.type, model.id)) {
      return;
    }
    this.getRankByType(model.type).push(model);
  }

  public getRankByType(type: string): DocModel[] {
    if (this.sideloadedRankModels[type] === undefined) {
      this.sideloadedRankModels[type] = [];
    }
    return this.sideloadedRankModels[type];
  }

  public getDocModelByTypeAndId(type: string, id: number): DocModel {
    const models: any[] =  this.getRankByType(type);
    if (!models) {
      return null;
    }
    return models.find((model) => model.id === id);
  }

  public getDocModelsByTypeAndIds(type: string, ids: number[]): DocModel[] {
    return ids.map(id => this.getDocModelByTypeAndId(type, id)).filter(doc => doc !== null);
  }

  public getDocModelIndexByTypeAndId(type: string, id: number): number {
    const models: any[] =  this.getRankByType(type);
    if (!models) {
      return -1;
    }
    return models.findIndex((model) => model.id === id);
  }

  public getRanks(): ISideloadedRankModels {
    return this.sideloadedRankModels;
  }

  public getFlattenedRanks(): DocModel[] {
    const ara = [];
    for(const key in this.sideloadedRankModels) {
      const collection = this.sideloadedRankModels[key];
      collection.map((doc) => ara.push(doc));
    }
    return ara;
  }
}
