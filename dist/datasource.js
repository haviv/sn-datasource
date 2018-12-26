'use strict';

System.register(['lodash'], function (_export, _context) {
  "use strict";

  var _, _createClass, GenericDatasource;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }
  function getMetrics(ci_type, all_metrics) {
    if (ci_type && ci_type != "select ci type"){
      return all_metrics[ci_type];
    }else{
      console.log("in getMetrics, ci type is empty ");
      var metrics = [];
      Object.keys(all_metrics).forEach(function(key) {
        metrics.push(key);
      })
      return metrics;
    }
  }
  function buildQuery(query, _type){
    var _query = "";
    if (_type == "timeserie"){
      _query = handleAdHocFilters(query.adhocFilters, "");
    }else{
      _query = handleAdHocFilters(query.adhocFilters, "cmdb_ci.");
    }
    return _query;
  }

  function mapToTextValue(result) {
    return _.map(result, function (d, i) {
      if (d && d.text && d.value) {                     
        return { text: d.text, value: d.value };
      } else if (d && d.metric ) {                     
        return { text: d.metric, value: d.metric };                      
      } else if (_.isObject(d)) {                        
        return { text: d, value: i };
      }                       
      return { text: d, value: d };
    });
  }
  function parse_clotho_result (response, tsResult){
    console.log("[parse_clotho_result] start");
    for (var i in response) {


      var obj = response[i];
      if ((!obj.seriesRef || !obj.seriesRef.metric) && (!obj.label) )
        continue;

      var metric = obj.label;
      var resObj = {};
      resObj.target = metric;
      if (obj.seriesRef && obj.seriesRef.metric){
          metric = obj.seriesRef.metric;
          resObj.target = metric +"@"+obj.label;
      }
      
      resObj.datapoints = [];
      for (var j in obj.values) {
          var val = [];

          if (obj.values[j].value == "NaN") //if no metric value or timestamp - continue
            continue;

          val.push(obj.values[j].value); //metric value
          var dateStr = obj.values[j].timestamp;
          val.push(new Date(dateStr).valueOf()); //metric timestamp
          resObj.datapoints.push(val);
      }
      tsResult.push(resObj);
      console.log("[parse_clotho_result] end:");


    }
}

function parse_table_result (response, tsResult){
  if (response.result){
    //console.log(JSON.stringify(response.result));
    var table = 
            {
              rows: [],
              columns: [],
              "type":"table"
            };
    
    for (var i in response.result) {
      var obj = response.result[i];
      var one_row = [];
      Object.keys(obj).forEach(function(key) {
        if (i == 0){
          var acolumn = {text : key , type: 'string'};
          table.columns.push(acolumn);
        }
        one_row.push(obj[key]);
        //console.log('Key : ' + key + ', Value : ' + obj[key])
      })
      table.rows.push(one_row);

    }
    tsResult.push(table);
    //console.log("++++"+JSON.stringify(table));    
  }
}

function doRequest(options) {
  options.withCredentials = this.withCredentials;
  options.headers = this.headers;

  return this.backendSrv.datasourceRequest(options);
}

function handleAdHocFilters(adhocFilters, prefix) {

    var _query = "";
    _.each(adhocFilters, function(filter) {

      _query +=  prefix + filter.key.replace("@", "") ;
       switch(filter.operator) {
        case "=":
            _query += "=" +filter.value +"^";
            break;
        case "!=":
            _query += "!=" +filter.value+"^";
            break;
        case ">":
            _query += ">=" +filter.value+"^";
            break;
        case "<":
            _query += "<=" +filter.value+"^";
            break;
        case "=~":
            _query += "LIKE" +filter.value+"^";
            break;
        case "!~":
            _query += "NOT%20LIKE" +filter.value+"^";
            break;
        default:
            _query += "LIKE" +filter.value+"^";
      } 
    });
    console.log("[handleAdHocFilters] ad hoc filter is:"+_query);
    return _query;  
    
}

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }],
    execute: function () {
      _createClass = function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      }();

      _export('GenericDatasource', GenericDatasource = function () {
        function GenericDatasource(instanceSettings, $q, backendSrv, templateSrv) {
          _classCallCheck(this, GenericDatasource);

          this.type = instanceSettings.type;
          this.url = instanceSettings.url;
          this.name = instanceSettings.name;
          this.q = $q;
          this.backendSrv = backendSrv;
          this.templateSrv = templateSrv;
          this.withCredentials = instanceSettings.withCredentials;
          this.headers = { 'Content-Type': 'application/json' };
          if (typeof instanceSettings.basicAuth === 'string' && instanceSettings.basicAuth.length > 0) {
            this.headers['Authorization'] = instanceSettings.basicAuth;
          }
        }

        _createClass(GenericDatasource, [{
          key: 'query',
          value: function query(options) {

            //======== build the query parameters =========
            var query = this.buildQueryParameters(options);
            query.targets = query.targets.filter(function (t) {
              return !t.hide;
            });

            if (query.targets.length <= 0) {
              return this.q.when({ data: [] });
            }

            if (this.templateSrv.getAdhocFilters) {
              query.adhocFilters = this.templateSrv.getAdhocFilters(this.name);
            } else {
              query.adhocFilters = [];
            }

            //========= handle regular expression in metrics names ========
            var all_metrics = sessionStorage.getItem("all_metrics");
            all_metrics = JSON.parse(all_metrics);
            var body = [];
            _.each(query.targets, function(target) {
              if (target.type == "timeserie" && target.target.includes(".*")){
                  var ci_metrics = all_metrics[target.ci_type];
                  var pattern = target.target;
                  _.each (ci_metrics, function (metric){
                    if (metric.metric.search(pattern) > -1){
                      var obj = JSON.parse(JSON.stringify(target));
                      obj.target = metric.metric;
                      body.push(obj);
                    }
                  });
              }else{
                body.push(target);
              }
            });
            console.log("body after regex:" + JSON.stringify(body));

            var _start = JSON.stringify(query.range.from).substring(1,20);
            var _end = JSON.stringify(query.range.to).substring(1,20);
            var _length = body.targets;
            var _this = this;
            var tsResult = {data : []};

        return new Promise(function (resolve, reject) {
            
            var numberOfTargets = body.length;
            var num_of_results = 0;
            //======== loop over all metrics(targets) =========
             _.each(body, function(target) {

                var _target = target.target;
                var _type = target.type;
                var _target_ci_type = target.ci_type;
                if (!_target){
                  return;
                }
                
                //======== resource case  =========
                console.log("[query] _target "+_target);
                if (_target.includes("/")){
                  console.log("[query] handling resource case "+_target);
                  
                  var ci_type_metrics = all_metrics[_target_ci_type];

                  var _metric = _target;
                  _.each(ci_type_metrics, function(metric) {
                      if (metric.metric == _metric){
                        _target = metric.metric.split("/")[1];
                        _target_ci_type = metric.resource;
                        target.query += "^name=" + metric.metric.split("/")[0];
                      }
                  });
                }
                console.log("[query]working on metric:"+ _target);
                console.log("[query]working on cit:"+ _target_ci_type);
                
                //======== handle ad hoc filters =========
                var _query = buildQuery (query, _type);
                

                //======== handle transform ======== 
                var _transform  = "";
                if (target.query)
                  _query += target.query;
                if(target.transform)
                  _transform = target.transform;

                //======== perform the call to clotho or table api ======== 
                console.log("_type is "+ _type);
                if (_type == "timeserie"){

                    var _ci_type = _target_ci_type;
                    var _path = '/api/now/v1/clotho/transform/'+_ci_type+"/"+_target+"?sysparm_query="+_query+"&sysparm_transforms="+_transform+"&sysparm_start="+_start+"&sysparm_end="+_end+"&sysparm_display_value=true&sysparm_subject_limit=1000"; 
                    console.log("[query]query is:"+_path);

                    _this.doRequest({
                      url: _this.url + _path,
                      method: 'GET'
                    }).then(function (result) {
                        console.log("[query] got result back from clotho, size:"+result.data.length);
                        parse_clotho_result (result.data, tsResult.data);
                        num_of_results++;
                        if (num_of_results == body.length){
                          //console.log("results is "+JSON.stringify(tsResult));
                          resolve(tsResult);
                        }
                    });

                }else{
                    console.log("fetching table:"+_target_ci_type);
                    if (!_target_ci_type){
                      return ;
                    }

                    var _fields = "";
                    var _path = '/api/now/table/'+_target_ci_type+"?sysparm_query="+_query+"&sysparm_fields="+_transform+"&sysparm_limit=1000&sysparm_display_value=true&sysparm_exclude_reference_link=true"; 
                    console.log("query is:"+_path);
                     _this.doRequest({
                        url: _this.url + _path,
                        method: 'GET'
                      }).then(function (result) {
                          console.log("[query] got result back from now table api ");
                          parse_table_result (result.data, tsResult.data);
                          num_of_results++;
                          if (num_of_results == body.length)
                            resolve(tsResult);
                      });

                }

            }); //end _.each
      });

          }
        }, {
          key: 'testDatasource',
          value: function testDatasource() {
            console.log("Starting testDatasource!!!");
            return this.doRequest({
              url: this.url + '/api/sn_itmon/monitoring',
              method: 'GET'
            }).then(function (response) {
              if (response.status === 200) {
                return { status: "success", message: "Data source is working", title: "Success" };
              }else{
                return { status: "error", message: "Data source is not working", title: "Error" };
              }
            });
          }
        }, {
          key: 'annotationQuery',
          value: function annotationQuery(options) {
            //TODO
          }
        }, {
          key: 'metricFindQuery',
          value: function metricFindQuery(ci_type) {
            
            var interpolated = {
              target: this.templateSrv.replace(ci_type, null, 'regex')
            };

            //take from cache
            var all_metrics_last_update_str = sessionStorage.getItem("all_metrics_last_update_str");
            var all_metrics_last_update;
            var all_metrics = sessionStorage.getItem("all_metrics");
            if (all_metrics_last_update_str){
              all_metrics_last_update = new Date(parseInt(all_metrics_last_update_str, 10));
            }
            if (all_metrics){
              all_metrics = JSON.parse(all_metrics);
            }
            
            if (all_metrics && all_metrics_last_update && (new Date().getTime() - all_metrics_last_update.getTime()  < 1000*60*60)){
              console.log("taking metrics from cache");
              var metrics = getMetrics(ci_type, all_metrics);
              return mapToTextValue(metrics);

            } else {
              console.log("taking metrics NOT from cache");
              console.log("ci_type is "+ci_type );

              return this.doRequest({
                  url: this.url + '/api/sn_itmon/monitoring/search',
                  data: "",
                  method: 'POST'
                  }).then(function (result) {
                    if (result && result.data){
                        var metrics = getMetrics(ci_type, result.data.result);
                        sessionStorage.setItem("all_metrics_last_update_str", "" + new Date().getTime());
                        sessionStorage.setItem("all_metrics", JSON.stringify(result.data.result));
                        return mapToTextValue(metrics);
                    }

                    

                    
                  });
            }
          }
        }, {
          key: 'doRequest',
          value: function doRequest(options) {
            options.withCredentials = this.withCredentials;
            options.headers = this.headers;

            return this.backendSrv.datasourceRequest(options);
          }
        }, {
          key: 'buildQueryParameters',
          value: function buildQueryParameters(options) {
            var _this = this;

            //remove placeholder targets
            options.targets = _.filter(options.targets, function (target) {
              console.log("buildQueryParameters");
              return (target.target !== 'select metric' && target.type == 'timeserie' ) ||
                     (target.ci_type !== 'select ci type' && target.type == 'table' );
            });
            console.log("buildQueryParameters.targets="+options.targets);
            var targets = _.map(options.targets, function (target) {
              return {
                target: _this.templateSrv.replace(target.target, options.scopedVars, 'regex'),
                refId: target.refId,
                hide: target.hide,
                query: target.query,
                transform: target.transform,
                ci_type: target.ci_type,
                type: target.type || 'timeserie'
              };
            });

            options.targets = targets;

            return options;
          }
        }, {
          key: 'getTagKeys',
          value: function getTagKeys(options) {
            var _this2 = this;

            console.log("calling getTagKeys");
            return new Promise(function (resolve, reject) {
              _this2.doRequest({
                url: _this2.url + '/api/sn_itmon/monitoring/tag_keys2',
                method: 'POST',
                data: options
              }).then(function (result) {
                return resolve(result.data.result);
              });
            });
          }
       
        }, {
          key: 'getTagValues',
          value: function getTagValues(options) {
            var _this3 = this;

            console.log("calling getTagValues");
            return new Promise(function (resolve, reject) {
              _this3.doRequest({
                url: _this3.url + '/api/sn_itmon/monitoring/tag_values2',
                method: 'POST',
                data: options
              }).then(function (result) {
                return resolve(result.data.result);
              });
            });
          }
        }]);

        return GenericDatasource;
      }());

      _export('GenericDatasource', GenericDatasource);
    }
  };
});
//# sourceMappingURL=datasource.js.map

