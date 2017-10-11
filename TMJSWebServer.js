/*
// modules required to be installed
npm install mime
npm install cookies
*/
console.log("Starting server");
var rootFolder="ROOT";
var rootFolderExists=false;
var rootConfigurationJSON;
var serverSideTechnologyExtension="technology";
var webApplicationFactory=require("./WebApplicationProcessor.js");
var httpServerFactory=require("http");
var fileSystemUtilities=require("fs");
var urlUtilities=require("url");
var applicationConfigurationFile="web.json";
var pathUtilities=require("path");
var qs = require('querystring');
var utils=require("./utils.js");
var webApplications={};
var sitesJSON={};
// folder scanning starts
var foldersToAnalyze=utils.getDirectories(".\\\webapps");
console.log(foldersToAnalyze);
foldersToAnalyze.forEach(function(folderName){
var privateFolder=folderName+"\\private";
var publicFolder=folderName+"\\public";
var privateFolderExists=utils.isDirectory(privateFolder);
var publicFolderExists=utils.isDirectory(publicFolder);
if(privateFolderExists && publicFolderExists)
{
var configurationJSON={};
var configurationFile=privateFolder+"\\"+applicationConfigurationFile;
var configurationFileExists=utils.isFile(configurationFile);
if(configurationFileExists)
{
var configurationJSONWrapper=utils.getJSONFromFile(configurationFile);
if(configurationJSONWrapper.success)
{
configurationJSON=configurationJSONWrapper.json;
}
else
{
console.log("--------------------------START-----------------------------");
console.log("Problems in "+folderName+" configuration : "+configurationJSONWrapper.error);
console.log("-------------------------- END ------------------------------");
return;
}
}
if(!(configurationJSON.resources)) configurationJSON.resources=[];
if(configurationJSON.contextName && utils.isValidContextName(configurationJSON.contextName)==false)
{
console.log("--------------------------START-----------------------------");
console.log("Problems in "+folderName+" configuration : Invalid context name");
console.log("-------------------------- END ------------------------------");
return;
}
var contextName="/";
if(configurationJSON.contextName)
{
if(!utils.isValidContextName(configurationJSON.contextName))
{
console.log("--------------------------START-----------------------------");
console.log("Problems in "+folderName+" configuration - Invalid context name : "+configurationJSON.contextName);
console.log("-------------------------- END ------------------------------");
return;
}
contextName=configurationJSON.contextName;
} else if(folderName!=rootFolder)
{
contextName="/"+folderName;
}

if(sitesJSON[contextName])
{
sitesJSON[contextName]=function(){};
}
else
{
sitesJSON[contextName]=function(){
var webApplication=webApplicationFactory.createWebApplication(contextName,folderName);
webApplication.configuration=configurationJSON;
var dynamicJSFolder="generatedJS\\"+webApplication.folderName;
utils.createFoldersSync(dynamicJSFolder);
webApplications[contextName]=webApplication;
};
}
if(folderName==rootFolder) rootFolderExists=true;
}
});
for(var s in sitesJSON)
{
sitesJSON[s]();
}
// if root does not exist
if(!rootFolderExists)
{
if(!(sitesJSON["/"]))
{
var webApplication=webApplicationFactory.createRootWebApplication();
webApplication["/"]=webApplication;
}
}
// display list of sites 
console.log("List of web applications");
console.log("-------------------------------");
for(var wa in webApplications) console.log(webApplications[wa].contextName);
console.log("-------------------------------");
// removing all WebApplication instances whose context names are not unique
var httpServer=httpServerFactory.createServer();
function customizeResponseObject(response)
{
response.setContentType=function(contentType)
{
response.writeHead(200,{"content-type": contentType});
};
response.addCookie=function(cookie)
{
var cookies=response.getHeader("Set-Cookie");
if(!cookies)
{
cookies=[];
}
cookies.push(cookie);
console.log("Cookies set : "+cookies);
response.setHeader("Set-Cookie",cookies);
//response.setHeader('Set-Cookie', ['type=ninja', 'language=javascript']);
}
}
function customizeRequestObject(request)
{
request.getCookies=function(){
return request.cookies;
};
request.getCookie=function(name){
return request.cookies[name];
};
}
function requestHandler(request,response)
{
customizeResponseObject(response);
customizeRequestObject(request);
request.requestURI=urlUtilities.parse(request.url).pathname;
var firstWord=request.requestURI.split("/")[1];
var contextName;
var webApplication;
if(firstWord.length==0)
{
contextName="/";
}
else
{
if((webApplications["/"+firstWord]))
{
contextName="/"+firstWord;
}
else
{
contextName="/";
}
}
webApplication=webApplications[contextName];
if(!(webApplication))
{
response.writeHead(404,{"content-type":"text/html"});
response.write("<html><head><title>TM Node Web Server/1.0 - Error report</title><STYLE><!--H1{font-family : sans-serif,Arial,Tahoma;color : white;background-color : #0086b2;} BODY{font-family : sans-serif,Arial,Tahoma;color : black;background-color : white;} B{color : white;background-color : #0086b2;} HR{color : #0086b2;} --></STYLE> </head><body><h1>TM Node Web Server/1.0 - HTTP Status 404 - "+request.requestURI+"</h1><HR size='1' noshade><p><b>type</b> Status report</p><p><b>message</b> <u>"+request.requestURI+"</u></p><p><b>description</b> <u>The requested resource ("+request.requestURI+") is not available.</u></p><HR size='1' noshade></body></html>");
response.end();
return;
}
request.contextName=contextName;
if(request.method.toUpperCase()=="GET")
{
var queryStringParameters=urlUtilities.parse(request.url,true).query;
if(!queryStringParameters) queryStringParameters={};
request.queryStringParameters=queryStringParameters;
var cookies = {};
if(request.headers && request.headers.cookie)
{
request.headers.cookie.split(';').forEach(function(cookie) {
var parts = cookie.match(/(.*?)=(.*)$/)
cookies[ parts[1].trim() ] = (parts[2] || '').trim();
});
}
request.cookies=cookies;
webApplication.process(request,response);
}
if(request.method.toUpperCase()=="POST")
{
            var buffer='';
            request.on('data', function (data) {
                buffer +=data;
            });
            request.on('end',function(){
                var queryStringParameters =  qs.parse(buffer);
	if(!queryStringParameters) queryStringParameters={};
	request.queryStringParameters=queryStringParameters;
	webApplication.process(request,response);
            });
}
}
httpServer.on('request',requestHandler);
httpServer.listen(3000);
console.log("http Server is listening on port 3000");
