/**
 * @file Code heatmap rendering.
 */

'use strict';
var d3scale = require('d3-scale');
var d3select = require('d3-selection');

var hljs = require('highlight.js');
try {
  require('./highlight.css');  // Includes code highlighter CSS.
} catch (e) {
  // Do nothing, it's workaround for Jest test runner.
}

/**
 * Represents code heatmap.
 * @constructor
 * @param {Object} parent - Parent element for code heatmap.
 * @param {Object} data - Data for code heatmap rendering.
 * @property {number} MIN_RUN_COUNT - Min value for line execution count.
 * @property {number} MAX_RUN_COUNT - Max value for line execution count.
 * @property {string} MIN_RUN_COLOR - Color that represents MIN_RUN_COUNT.
 * @property {string} MAX_RUN_COLOR - Color that represents MAX_RUN_COUNT.
 */
function CodeHeatmap(parent, data) {
  this.MIN_RUN_TIME = 0.000001;
  this.MAX_RUN_TIME = data.runTime;
  this.MIN_RUN_COLOR = '#ebfaeb';
  this.MAX_RUN_COLOR = '#47d147';
  this.HELP_MESSAGE = (
    '<p>&#8226 Hover over line to see line execution count.</p>');

  this.data_ = data;
  this.parent_ = parent;
  this.heatmapScale_ = d3scale.scaleLog()
    .domain([this.MIN_RUN_TIME, this.MAX_RUN_TIME])
    .range([this.MIN_RUN_COLOR, this.MAX_RUN_COLOR]);
}

/** Renders code heatmap. */
CodeHeatmap.prototype.render = function() {
  var pageContainer = this.parent_.append('div')
    .attr('id', 'heatmap-layout');

  this.renderHelp_();

  var moduleList = pageContainer.append('div')
    .attr('class', 'heatmap-module-list');

  moduleList.append('div')
    .attr('class', 'heatmap-module-header')
    .html('Inspected modules');

  moduleList.selectAll('.heatmap-module-name')
    .data(this.data_.heatmaps)
    .enter()
    .append('a')
    .attr('href', function(d) { return '#' + d.name; })
    .append('div')
    .attr('class', 'heatmap-module-name')
    .append('text')
    .html(function(d) { return d.name; });

  var codeContainer = pageContainer.append('div')
    .attr('class', 'heatmap-code-container');

  var heatmapContainer = codeContainer.selectAll('div')
    .data(this.data_.heatmaps)
    .enter()
    .append('div')
    .attr('class', 'heatmap-src-file');

  heatmapContainer.append('a')
    .attr('href', function(d) { return '#' + d.name; })
    .attr('class', 'heatmap-src-code-header')
    .attr('id', function(d) { return d.name; })
    .append('text')
    .html(function(d) { return d.name; });

  var renderedSources = [];
  for (var i = 0; i < this.data_.heatmaps.length; i++) {
    renderedSources.push(this.renderCode_(this.data_.heatmaps[i]));
  }

  var fileContainers = heatmapContainer.append('div')
    .attr('class', 'heatmap-src-code')
    .append('text')
    .html(function(_, i) { return renderedSources[i].srcCode; })
    .nodes();

  var tooltip = pageContainer.append('div')
    .attr('class', 'content-tooltip content-tooltip-invisible');

  var self = this;
  codeContainer.selectAll('.heatmap-src-file')
    .each(function(_, i) {
      d3select.select(fileContainers[i]).selectAll('.heatmap-src-line-normal')
        .on('mouseover', function(_, j) {
          if(renderedSources[i].countMap[j]) {
            self.showTooltip_(
              this, tooltip, renderedSources[i].timeMap[j],
              renderedSources[i].countMap[j], self.data_.runTime);
          }
        })
        .on('mouseout', function() { self.hideTooltip_(this, tooltip); });
    });
};

/**
 * Shows line execution count inside tooltip and adds line highlighting.
 * @param {Object} element - Element representing highlighted line.
 * @param {Object} tooltip - Element representing tooltip.
 * @param {number} lineRuntime - Time spent on line.
 * @param {number} lineRuncount - Line execution count.
 */
CodeHeatmap.prototype.showTooltip_ = function(element, tooltip,
                                              lineRuntime, lineRuncount,
                                              totalTime) {
  d3select.select(element).attr('class', 'heatmap-src-line-highlight');
  tooltip.attr('class', 'content-tooltip content-tooltip-visible')
    .html('<p><b>Time spent: </b>' + lineRuntime + ' s</p>' +
          '<p><b>Total running time: </b>' + totalTime + ' s</p>' +
          '<p><b>Percentage: </b>' + 100 * (lineRuntime / totalTime) + '%</p>' +
          '<p><b>Run count: </b>' + lineRuncount + '</p>')
    .style('left', d3select.event.pageX)
    .style('top', d3select.event.pageY);
};

/**
 * Hides provided tooltip and removes line highlighting.
 * @param {Object} element - Element representing highlighted line.
 * @param {Object} tooltip - Element representing tooltip.
 */
CodeHeatmap.prototype.hideTooltip_ = function(element, tooltip) {
  d3select.select(element).attr('class', 'heatmap-src-line-normal');
  tooltip.attr('class', 'content-tooltip content-tooltip-invisible');
};

/**
 * Renders source code.
 * @param {Object} stats - Object that contains source code and all code stats.
 * @returns {Object}
 */
CodeHeatmap.prototype.renderCode_ = function(stats) {
  var outputCode = [], timeMap = {}, srcIndex = 0, countMap = {};
  for (var i = 0; i < stats.srcCode.length; i++) {
    if (stats.srcCode[i][0] === 'line') {
      var lineNumber = stats.srcCode[i][1], codeLine = stats.srcCode[i][2];
      outputCode.push(
          this.formatSrcLine_(lineNumber, codeLine, stats.heatmap[lineNumber]));
      timeMap[srcIndex] = stats.heatmap[lineNumber];
      countMap[srcIndex] = stats.executionCount[lineNumber];
      srcIndex++;
    } else if (stats.srcCode[i][0] === 'skip') {
      outputCode.push(
          "<div class='heatmap-skip-line'>" + stats.srcCode[i][1] +
          ' lines skipped</div>');
    }
  }
  return {
    'srcCode': outputCode.join(''),
    'timeMap': timeMap,
    'countMap': countMap
  };
};

/**
 * Formats single line of Python source file.
 * @param {number} lineNumber - Line number for code browser.
 * @param {string} codeLine - Source line.
 * @param {number} runCount - Number of line runs.
 * @returns {string}
 */
CodeHeatmap.prototype.formatSrcLine_ = function(lineNumber, codeLine,
                                                runCount) {
  var highlightedLine = hljs.highlight('python', codeLine).value;
  var backgroundColor = runCount ? this.heatmapScale_(runCount) : '';
  return (
      "<div class='heatmap-src-line-normal' style='background-color: " +
        backgroundColor + "'>" +
          "<div class='heatmap-src-line-number'>" + lineNumber + "</div>" +
          "<div class='heatmap-src-line-code'>" + highlightedLine + "</div>" +
      "</div>");
};

/** Renders code heatmap help. */
CodeHeatmap.prototype.renderHelp_ = function() {
  this.parent_.append('div')
    .attr('class', 'tabhelp inactive-tabhelp')
    .html(this.HELP_MESSAGE);
};

/**
 * Renders code heatmap and attaches it to parent.
 * @param {Object} parent - Parent element for code heatmap.
 * @param {Object} data - Data for code heatmap rendering.
 */
function renderCodeHeatmap(data, parent) {
  var heatmap = new CodeHeatmap(parent, data);
  heatmap.render();
}

module.exports = {
  'CodeHeatmap': CodeHeatmap,
  'renderCodeHeatmap': renderCodeHeatmap,
};
