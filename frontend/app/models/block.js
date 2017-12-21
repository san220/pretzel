import Ember from 'ember';
import DS from 'ember-data';
import attr from 'ember-data/attr';
import { PartialModel, partial } from 'ember-data-partial-model/utils/model';

const { inject: { service } } = Ember;

export default DS.Model.extend({
  session: service('session'),
  name: attr('string'),
  // tags: attr('null', { defaultValue: []}),
  // tags: attr(),
  annotations: DS.hasMany('annotation', { async: false }),
  intervals: DS.hasMany('interval', { async: false }),
  createdAt: attr("date"),
  updatedAt: attr("date"),
  // id: attr('string'),
  geneticmapId: attr('string'),
  clientId: attr('string'),
  public: attr('boolean'),
  //extended: partial('chromosome', 'extended', {
  markers: DS.hasMany('marker', { async: false }),
  //}),

  extraChrs: [],
  isSelected: false,

  owner: Ember.computed('clientId', function() {
    let clientIdSession = this.get('session.data.authenticated.clientId')
    let clientId = this.get('clientId')
    return clientIdSession == clientId;
  }),

  linkTo: Ember.computed('name', function() {
    return [this.get("id")];
  }),

  chrDeleteLink: Ember.computed('extraChrs', function() {
    let exChrs = this.get("extraChrs");
    let that = this;
    // console.log("chrDeleteLink", this.get('name'), this.get('id'), exChrs);
    return exChrs.filter(function(chrid) { return chrid != that.get("id"); });
  }),

  chrLink: Ember.computed('extraChrs', function() {
    var retlist = this.get("extraChrs");
    // console.log("chrLink", this.get('name'), this.get('id'), retlist);
    if (retlist == null) {
      return [this.get("id")];
    }
    else {
      retlist.push(this.get("id"));
      return retlist;
    }
  })
});