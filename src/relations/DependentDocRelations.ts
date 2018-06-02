import {DataRelations} from "./DataRelations";
import {DocModel} from "../DocModel";

export class DependentDocRelations extends DataRelations {
  constructor() {
    super();
  }
  setBelongsTo(from: DocModel, relation: string, to: DocModel) {
    const { type, id } = to;
    super.set<DocModel>(type, id, relation, from);
  }
  setHasMany(from: DocModel, relation: string, to: Array<DocModel>) {
    to.forEach((toModel: DocModel) => this.setBelongsTo(from, relation, toModel));
  }
  pushToBelongsTo(from: DocModel, relation: string, to: DocModel) {
    this.setBelongsTo(from, relation, to);
  }
  pushToHasMany(from: DocModel, relation: string, to: DocModel) {
    this.setBelongsTo(from, relation, to);
  }
  shiftFromBelongsTo(from: DocModel, relation: string, to: DocModel) {
    const { type, id } = to;
    super.unset(type, id, relation);
  }
  shiftFromHasMany(from: DocModel, relation: string, to: DocModel) {
    this.shiftFromBelongsTo(from, relation, to);
  }
}
