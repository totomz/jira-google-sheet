///// SCRIPT CONFIGURATION /////

// Credential for a JIRA user that have access to the REST API
var jira_auth = "USER:PASSWORD";

// The URL to the REST API of your JIRA instance
var jira_endpoint = "https://YOU.atlassian.net/rest/api/2/";

// JQL to get the list of issues. To list issues in a sprint not started, use "Sprint in futureSprints()"
var jira_query = "Sprint in openSprints()"

// Define the aggregations to calculate
var metrics = [{
  name: "Points per Category",  // REQUIRED
  data: {},                     // REQUIRED
  func: function(issue){        // REQUIRED - function that perform th "groupBy" function and store the result in data
    var category = utils.getProjectCategory(issue);
    var storyPoint = issue.fields[getFieldId('Story Points')];
    var assignee = utils.getAssignee(issue);
    
    this.data[category] = this.data[category] || 0;
    this.data[category] += storyPoint;      
  }
},{
  name: 'Points per User',
  data: {},
  func: function(issue){
    var storyPoint = issue.fields[getFieldId('Story Points')];    
    var assignee = utils.getAssignee(issue);
    
    this.data[assignee] = this.data[assignee] || 0;     
    this.data[assignee] += storyPoint;
  }
},{
  name: 'Points per User on Project',
  data: {},
  func: function(issue){
    var storyPoint = issue.fields[getFieldId('Story Points')];
    var category = utils.getProjectCategory(issue); 
    var assignee = utils.getAssignee(issue);
    
    this.data[assignee] = this.data[assignee] || {};
    this.data[assignee][category] = this.data[assignee][category] || 0;
    this.data[assignee][category] += storyPoint;   
  },
  doOutput: function(){ // OPTIONAL custom output function
    
    var rows = [];
    var kToId = {};
    var id = 0;
    
    for(var assignee in this.data) {
      var row = [assignee];
      for(var category in this.data[assignee]) {
        kToId[category] = kToId[category] || ++id;
        row[kToId[category]] = this.data[assignee][category]        
      }
      rows.push(row);
    }
    
    var temp = [" "];
    for(var category in kToId) {
      temp.push(category);
    }
    
    rows.unshift(temp);
    return rows;    
  }
}];
///// END SCRIPT CONFIGURATION /////

// Common functions to be used with JIRA issues
var utils = {
  getAssignee: function(issue){return (issue.fields.assignee)?issue.fields.assignee.key:'unassigned';},
  getProjectCategory: function(issue){return (issue.fields.project.projectCategory)?issue.fields.project.projectCategory.name:issue.fields.project.key;}
}

/**
 * Quick GET query to JIRA
 * @params query {String} everything that should be added to the ase REST API url
 */
function jiraFetch(query) {  
  var url = jira_endpoint + query    
  return JSON.parse(UrlFetchApp
                    .fetch(url, {
                           'method' : 'get',
                           'contentType': 'application/json',
                           'headers' : {"Authorization": "Basic " + Utilities.base64Encode(jira_auth)}
                    })
                    .getContentText());
}

/**
* @return the field.id for the first field found with a given name. The result is cached only for the current execution 
*/
function getFieldId(fieldName){

  if(!_getFieldIdCache[fieldName]){
    _getFieldIdCache[fieldName] = jiraFetch('field')
      .filter(function(field){
        return field.name === fieldName
      })[0].key;
  }
  return _getFieldIdCache[fieldName];
  
}
var _getFieldIdCache = {}; // LOL

/**
 Colelct the metrics from JIRA and write the results in the first Sheet found
*/
function grabJiraData() {
  
  var storyPointField = getFieldId('Story Points');
  var data = jiraFetch('search?jql=' + jira_query + 
                       '&fields=project,assignee,' + storyPointField);
  
  // Collect the metrics
  data.issues.forEach(function(issue, index, array){
    metrics.forEach(function(metric,_index,_array){
      metric.func(issue);
    });
  });
  
  // Write everything in the Spreadsheet
  var sheet = SpreadsheetApp.getActiveSheet();
  sheet.clear();
  
  metrics.forEach(function(metric,_index,_array){
 
    sheet.appendRow([metric.name]);
    sheet.getRange(sheet.getLastRow(), "1").setFontWeight("bold");

    // Default output function
    metric.doOutput = metric.doOutput || function(){
      var rows = [];
      for(var k in this.data) {
        rows.push([k, this.data[k]]);
      }
      return rows;
    }
    
    metric.doOutput().forEach(function(row){
      
      for(var i=0; i<row.length; i++){
        if(!row[i]){
          row[i] = " ";
        }
      };
      
      sheet.appendRow(row);
    });
    
    sheet.appendRow([" "]);
  });
  
}

