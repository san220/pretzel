import Ember from 'ember';

import AxisEvents from '../../utils/draw/axis-events';
import { /* Block, Stacked, Stack,*/ stacks /*, xScaleExtend, axisRedrawText, axisId2Name*/ } from '../../utils/stacks';
import {  /* Axes, yAxisTextScale,  yAxisTicksScale,  yAxisBtnScale, yAxisTitleTransform, eltId,*/ axisEltId /*, eltIdAll, highlightId*/ , axisTitleColour  }  from '../../utils/draw/axis';
import {DragTransition, dragTransitionTime, dragTransitionNew, dragTransition } from '../../utils/stacks-drag';
import { breakPoint } from '../../utils/breakPoint';



/* global d3 */


/*------------------------------------------------------------------------*/

/* milliseconds duration of transitions in which axis ticks are drawn / changed.
 * Match with time used by draw-map.js : zoom() and resetZoom() : 750.
 * also @see   dragTransitionTime.
 */
const axisTickTransitionTime = 750;

function blockKeyFn(block) { return block.axisName; }

/** Get an attribute of an object which may be an ember store object, or not.
 * Ember data operations such as findAll() will return ember store objects,
 * and ajax requests which return JSON will be parsed into plain JS objects.
 * Further details in comment in axis-1d.js : @see keyFn()
 */
function getAttrOrCP(object, attrName) {
  return object.get ? object.get(attrName) : object[attrName];
}

/*------------------------------------------------------------------------*/


/*------------------------------------------------------------------------*/


/* showTickLocations() and configureHorizTickHover() are based on the
 * corresponding functions in draw-map.js
 * There is a lot of variation at all levels between this application and the
 * original - draft factoring (axisDomData.js) showed a blow-out of abstraction
 * and complexity even before all the differences were handled.
 */

const className = "horizTick";

/** filter : @return true if the given Block is configured to display ticks.
 * i.e. ! block.block.get('dataset').get('showPaths')
 */
function blockWithTicks(block)
{
  let showPaths = block.block.get('showPaths');
  // console.log('blockWithTicks', block.axisName, showPaths);
  return ! showPaths;
}

function selectAxis(axis)
{
  let axisName = axis.axisName;
  let aS = d3.select("#" + axisEltId(axisName));
  return aS;
}
/** Draw horizontal ticks on the axes, at feature locations.
 * This is used for 2 cases so far :
 * . all features of blocks which have !showPaths, when axis is ! extended
 * . features found in blocks using feature search (goto-feature-list)
 *
 * @param axis  Stacked
 * @param axisApi for lineHoriz
 * @param axis1d axis-1d component, to lookup axisObj.extended
 */
function FeatureTicks(axis, axisApi, axis1d)
{
  this.axis = axis;
  this.axisApi = axisApi;
  this.axis1d = axis1d;
}

/** Draw horizontal ticks on the axes, at feature locations.
 */
FeatureTicks.prototype.showTickLocations = function (featuresOfBlockLookup, setupHover, groupName, blockFilter)
{
  let axis = this.axis, axisApi = this.axisApi;
  let axisName = axis.axisName;
  let
    range0 = axis.yRange2();
  let
    axisObj = this.axis1d.get('axisObj'),
  /** using the computed function extended() would entail recursion. */
  extended = axisObj && axisObj.extended;
  console.log('showTickLocations', extended, axisObj, groupName);

  function blockTickEltId(block) { return className + '_' + groupName + '_' + block.axisName; }

  let blockIndex = {};
  let aS = selectAxis(axis);
  if (!aS.empty())
  {
    /** show no ticks if axis is extended. */
    let blocks = (extended ? [] : blockFilter ? axis.blocks.filter(blockWithTicks) : axis.blocks);
    let gS = aS.selectAll("g." + className + '.' + groupName)
      .data(blocks, blockKeyFn);
    gS.exit().remove();
    function storeBlockIndex (block, i) {
      blockIndex[block.getId()] = i;
      console.log('blockIndex', block.getId(), i);
    };
    let gA = gS.enter()
      .append('g')
      .attr('id', blockTickEltId)
      .attr('class', className + ' ' + groupName)
    ;
    /** data blocks of the axis, for calculating blockIndex i.e. colour.
     * colour assignment includes non-visible blocks . */
    let blocksUnfiltered = extended ? [] : axis.dataBlocks(false);
    console.log('blockIndex', axisName, axis, axis.blocks);
    blocksUnfiltered.forEach(storeBlockIndex);

    function featuresOfBlock (block) {
      function inRange(feature) {
        /** comment in @see keyFn() */
        let featureName = getAttrOrCP(feature, 'name');
        return axisApi.inRangeI(block.axisName, featureName, range0);
      }

      let blockR = block.block,
      blockId = blockR.get('id'),
      featuresAll = (featuresOfBlockLookup || function (blockR) {
        return blockR.get('features').toArray();
      })(blockR),
      features = featuresAll
        .filter(inRange);
      console.log(blockId, features.length);
      return features;
    };

    let gSA = gS.merge(gA),
    pS = gSA
      .selectAll("path." + className)
        .data(featuresOfBlock, keyFn),
      pSE = pS.enter()
        .append("path")
        .attr("class", className)
    ;
    function featurePathStroke (feature, i2) {
        let block = this.parentElement.__data__,
        blockId = block.getId(),
        /** Add 1 to i because it is the elt index, not the
         * index within axis.blocks[], i.e. the reference block is not included. */
        i = blockIndex[blockId];
      if (i2 < 2)
         console.log(this, 'stroke', blockId, i);
        return axisTitleColour(blockId, i+1) || 'black';
      }

    if (setupHover === true)
    {
    setupHover = 
    function setupHover (feature) 
    {
      let block = this.parentElement.__data__;
      return configureHorizTickHover.apply(this, [feature, block, hoverTextFn]);
    };

      pSE
        .each(setupHover);
    }
      pS.exit()
        .remove();
      let pSM = pSE.merge(pS);

      /* update attr d in a transition if one was given.  */
      let p1 = // (t === undefined) ? pSM :
         pSM.transition()
         .duration(axisTickTransitionTime)
         .ease(d3.easeCubic);

      p1.attr("d", pathFn)
      .attr('stroke', featurePathStroke)
    ;


  }

  function keyFn (feature) {
    // here `this` is the parent of the <path>-s, e.g. g.axis

    /** If feature is the result of block.get('features') then it will be an
     * ember store object, but if it is the result of featureSearch() then it will be
     * just the data attributes, and will not implement .get().
     * Using feature.name instead of feature.get('name') will work in later
     * versions of Ember, and will work after the computed property is
     * evaluated, because name attribute does not change.
     * The function getAttrOrCP() will use .get if defined, otherwise .name (via ['name']).
     * This comment applies to use of 'feature.'{name,range,value} in
     * inRange() (above), and keyFn(), pathFn(), hoverTextFn() below.
     */
    let featureName = getAttrOrCP(feature, 'name');
    // console.log('keyFn', feature, featureName); 
    return featureName;
  };
  function pathFn (feature) {
    // based on axisFeatureTick(ai, d)
    /** shiftRight moves right end of tick out of axis zone, so it can
     * receive hover events.
     */
    let xOffset = 25, shiftRight=5;
    /* the requirements for foundFeatures path will likely evolve after trial,
     * so this informal customisation is sufficient until the requirements are
     * settled.
     */
    if (groupName === 'foundFeatures') {
      xOffset = 35;
    }
    let ak = axisName,
    range = getAttrOrCP(feature, 'range') || getAttrOrCP(feature, 'value'),
    tickY = range && (range.length ? range[0] : range),
    sLine = axisApi.lineHoriz(ak, tickY, xOffset, shiftRight);
    return sLine;
  };

  /** eg: "scaffold23432:1A:1-534243" */
  function hoverTextFn (feature, block) {
    let
      /** value is now renamed to range, this handles some older data. */
      range = getAttrOrCP(feature, 'range') || getAttrOrCP(feature, 'value'),
    rangeText = range && (range.length ? ('' + range[0] + ' - ' + range[1]) : range),
    blockR = block.block,
    featureName = getAttrOrCP(feature, 'name'),
    scope = blockR && blockR.get('scope'),
    text = [featureName, scope, rangeText]
      .filter(function (x) { return x; })
      .join(" : ");
    return text;
  };
  // the code corresponding to hoverTextFn in the original is :
  // (location == "string") ? location :  "" + location;

};

/** Setup hover info text over scaffold horizTick-s.
 * @see based on similar configureAxisTitleMenu()
 */
function  configureHorizTickHover(d, block, hoverTextFn)
{
  // console.log("configureHorizTickHover", d, this, this.outerHTML);
  let text = hoverTextFn(d, block);
  let node_ = this;
  Ember.$(node_)
    .popover({
      trigger : "click hover",
      sticky: true,
      delay: {show: 200, hide: 3000},
      container: 'div#holder',
      placement : "auto right",
      // comment re. title versus content in @see draw-map.js: configureHorizTickHover() 
      content : text,
      html: false
    });
}

export default Ember.Component.extend(Ember.Evented, AxisEvents, {


  /** axis-1d receives axisStackChanged and zoomedAxis from draw-map
   * zoomedAxis is specific to an axisID, so respond to that if it matches this.axis.
   */

  resized : function(widthChanged, heightChanged, useTransition) {
    /* useTransition could be passed down to showTickLocations()
     * (also could pass in duration or t from showResize()).
     */
    console.log("resized in components/axis-1d");
    if (heightChanged)
      this.renderTicksDebounce();
  },

  axisStackChanged : function() {
    console.log("axisStackChanged in components/axis-1d");
    this.renderTicksDebounce();
  },

  /** @param [axisID, t] */
  zoomedAxis : function(axisID_t) {
    let axisID = axisID_t[0],
    axisName = this.get('axis.id');
    console.log("zoomedAxis in components/axis-1d", axisID_t, axisName);
    if (axisID == axisName)
    {
      console.log('zoomedAxis matched', axisID, this.get('axis'));
      // Not currently needed because axisStackChanged() already received.
      // this.renderTicksDebounce.apply(this, axisID_t);
    }
  },

  axisObj : Ember.computed('axes2d.[]', function () {
    let axes2d = this.get('axes2d'),
    axisID = this.get('axis.id'),
    axisObj = axes2d.findBy('axisID', axisID);
    console.log('axes2d', axes2d, axisID, 'axisObj', axisObj, axisObj && axisObj.extended);
    return axisObj;
  }),
  extended : Ember.computed('axisObj', 'axisObj.extended', function () {
    let axisObj = this.get('axisObj'),
    /** axes are (currently) added to axes2d when they are first extended, so if
     * axis.id is not in the list then it is not extended. (Will likely replace
     * axes2d with a list of sub-components, like axis-2d : subComponents but
     * with axisID as source array)
     */
    extended = (axisObj === undefined) ? false : this.get('axisObj.extended'),
    axisID = this.get('axis.id');
    console.log('extended', extended, axisID, this.get('axisObj'));
    if (extended)
      this.removeTicks();
    else
    {
      let axisID_t = [axisID, undefined];
      this.renderTicksDebounce(axisID_t);
    }
    return extended;
  }),

  didReceiveAttrs() {
    this._super(...arguments);
    this.get('featureTicks') || this.constructFeatureTicks();
  },
  didInsertElement() {
    this._super(...arguments);
    console.log('axis-1d didInsertElement', this, this.get('listen') !== undefined);
  },
  willDestroyElement() {
    console.log('willDestroyElement');
    this.removeTicks();
    this._super(...arguments);
  },
  removeTicks() {
    /** Select all the <path.horizTick> of this axis and remove them.
     * Could use : this.renderTicks() because when ! axis.extended,
     * showTickLocations() will use features == [], which will remove ticks;
     */
    let axis = this.get('axis'),
    aS = selectAxis(axis),
    pS = aS.selectAll("path." + className);
    pS.remove();
  },
  didRender() {
    this.get('renderTicks').apply(this, []);
  },
  constructFeatureTicks () {
    /** There is 1 axis-1d component per axis, so here `block` is an axis (Stacked),
     * Can rename it to axis, assuming this structure remains.
     */
    let block = this.get('axis'), blockId = block.get('id');
    console.log('constructFeatureTicks', blockId, this);
    let axisApi = this.get('drawMap.oa.axisApi');
    let oa = this.get('drawMap.oa');
    let axis = oa.axes[blockId];
    // console.log('axis-1d renderTicks', block, blockId, axis);

    /* If block is a child block, don't render, expect to get an event for the
     * parent (reference) block of the axis. */
    if (! axis)
      console.log('renderTicks block', block, blockId, oa.stacks.blocks[blockId]);
    else {
      let featureTicks = new FeatureTicks(axis, axisApi, this);
      console.log('featureTicks', featureTicks);
      this.set('featureTicks',  featureTicks);
    }
  },
  renderTicks() {
    this.get('featureTicks').showTickLocations(undefined, true, 'notPaths', true);
  },
  /** call renderTicks().
   * filter / debounce the calls to handle multiple events at the same time.
   * @param axisID_t is defined by zoomedAxis(), undefined when called from
   * axisStackChanged()
   */
  renderTicksDebounce(axisID_t) {
    console.log('renderTicksDebounce', axisID_t);
    // renderTicks() doesn't use axisID_t; this call chain is likely to be refined yet.
    /* using throttle() instead of debounce() - the former has default immediate==true.
     * It is possible that the last event in a group may indicate a change which
     * should be rendered, but in this case it is likely there is no change
     * after the first event in the group.
     */
    Ember.run.throttle(this, this.renderTicks, axisID_t, 500);
  }


  
});

