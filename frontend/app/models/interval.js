import DS from 'ember-data';
import attr from 'ember-data/attr';
import { PartialModel, partial } from 'ember-data-partial-model/utils/model';

export default DS.Model.extend({
  name: attr('string'),
  starting: attr('string'),
  ending: attr('string'),
  createdAt: attr("date"),
  updatedAt: attr("date")
});