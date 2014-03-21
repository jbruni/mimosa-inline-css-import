"use strict";

var fs = require('fs');
var logger = null;

/*
 * Adapted from https://github.com/jrburke/r.js/blob/master/build/jslib/optimize.js
 */
var inlineCSSimport = (function() {
  var backSlashRegExp = /\\/g,
      cssImportRegExp = /\@import\s+(url\()?\s*([^);]+)\s*(\))?([\w, ]*)(;)?/ig,
      cssCommentImportRegExp = /\/\*[^\*]*@import[^\*]*\*\//g,
      cssUrlRegExp = /\url\(\s*([^\)]+)\s*\)?/g;

  function cleanCssUrlQuotes(url) {
      url = url.replace(/\s+$/, "");

      if (url.charAt(0) === "'" || url.charAt(0) === "\"") {
          url = url.substring(1, url.length - 1);
      }

      return url;
  }

  function fixCssUrlPaths(fileName, path, contents, cssPrefix) {
      return contents.replace(cssUrlRegExp, function (fullMatch, urlMatch) {
          var colonIndex, firstChar, parts, i,
              fixedUrlMatch = cleanCssUrlQuotes(urlMatch);

          fixedUrlMatch = fixedUrlMatch.replace(backSlashRegExp, "/");

          //Only do the work for relative URLs. Skip things that start with / or #, or have
          //a protocol.
          firstChar = fixedUrlMatch.charAt(0);
          colonIndex = fixedUrlMatch.indexOf(":");
          if (firstChar !== "/" && firstChar !== "#" && (colonIndex === -1 || colonIndex > fixedUrlMatch.indexOf("/"))) {
              //It is a relative URL, tack on the cssPrefix and path prefix
              urlMatch = cssPrefix + path + fixedUrlMatch;

          }

          //Collapse .. and .
          parts = urlMatch.split("/");
          for (i = parts.length - 1; i > 0; i--) {
              if (parts[i] === ".") {
                  parts.splice(i, 1);
              } else if (parts[i] === "..") {
                  if (i !== 0 && parts[i - 1] !== "..") {
                      parts.splice(i - 1, 2);
                      i -= 1;
                  }
              }
          }

          return "url(" + parts.join("/") + ")";
      });
  }

  function flattenCss(fileName, fileContents, cssImportIgnore, cssPrefix, included, topLevel) {
      //Find the last slash in the name.
      fileName = fileName.replace(backSlashRegExp, "/");
      var endIndex = fileName.lastIndexOf("/"),
          //Make a file path based on the last slash.
          //If no slash, so must be just a file name. Use empty string then.
          filePath = (endIndex !== -1) ? fileName.substring(0, endIndex + 1) : "",
          //store a list of merged files
          importList = [],
          skippedList = [];

      //First make a pass by removing any commented out @import calls.
      fileContents = fileContents.replace(cssCommentImportRegExp, '');

      //Make sure we have a delimited ignore list to make matching faster
      if (cssImportIgnore && cssImportIgnore.charAt(cssImportIgnore.length - 1) !== ",") {
          cssImportIgnore += ",";
      }

      fileContents = fileContents.replace(cssImportRegExp, function (fullMatch, urlStart, importFileName, urlEnd, mediaTypes) {
          //Only process media type "all" or empty media type rules.
          if (mediaTypes && ((mediaTypes.replace(/^\s\s*/, '').replace(/\s\s*$/, '')) !== "all")) {
              skippedList.push(fileName);
              return fullMatch;
          }

          importFileName = cleanCssUrlQuotes(importFileName);

          //Ignore the file import if it is part of an ignore list.
          if (cssImportIgnore && cssImportIgnore.indexOf(importFileName + ",") !== -1) {
              return fullMatch;
          }

          //Make sure we have a unix path for the rest of the operation.
          importFileName = importFileName.replace(backSlashRegExp, "/");

          try {
              //if a relative path, then tack on the filePath.
              //If it is not a relative path, then the readFile below will fail,
              //and we will just skip that import.
              var fullImportFileName = importFileName.charAt(0) === "/" ? importFileName : filePath + importFileName,
                  importContents = fs.readFileSync(fullImportFileName, 'utf8'),
                  importEndIndex, importPath, flat;

              //Skip the file if it has already been included.
              if (included[fullImportFileName]) {
                  return '';
              }
              included[fullImportFileName] = true;

              //Make sure to flatten any nested imports.
              flat = flattenCss(fullImportFileName, importContents, cssImportIgnore, cssPrefix, included);
              importContents = flat.fileContents;

              if (flat.importList.length) {
                  importList.push.apply(importList, flat.importList);
              }
              if (flat.skippedList.length) {
                  skippedList.push.apply(skippedList, flat.skippedList);
              }

              //Make the full import path
              importEndIndex = importFileName.lastIndexOf("/");

              //Make a file path based on the last slash.
              //If no slash, so must be just a file name. Use empty string then.
              importPath = (importEndIndex !== -1) ? importFileName.substring(0, importEndIndex + 1) : "";

              //fix url() on relative import (#5)
              importPath = importPath.replace(/^\.\//, '');

              //Modify URL paths to match the path represented by this file.
              importContents = fixCssUrlPaths(importFileName, importPath, importContents, cssPrefix);

              importList.push(fullImportFileName);
              return importContents;
          } catch (e) {
              return fullMatch;
          }
      });

      if (cssPrefix && topLevel) {
          //Modify URL paths to match the path represented by this file.
          fileContents = fixCssUrlPaths(fileName, '', fileContents, cssPrefix);
      }

      return {
          importList : importList,
          skippedList: skippedList,
          fileContents : fileContents
      };
  }

  function flattenCssTopLevel(fileName, fileContents) {
    return flattenCss(fileName, fileContents, '', '', {}, true).fileContents;
  }

  return flattenCssTopLevel;
})();

var _inlineCSSimport = function( config, options, next ) {
  var hasFiles = options.files && options.files.length > 0;
  if ( !hasFiles ) {
    return next();
  }

  options.files.forEach( function ( file, i ) {
    var fileName = file.outputFileName;
    var text = file.outputFileText;
    if ( config.inlineCSSimport.excludeRegex && fileName.match( config.inlineCSSimport.excludeRegex ) ) {
      logger.debug( "Not going to inline imports for [[ " + fileName + " ]], it has been excluded with a regex." );
    } else if ( config.inlineCSSimport.exclude.indexOf( fileName ) > -1 ) {
      logger.debug( "Not going to inline imports for [[ " + fileName + " ]], it has been excluded with a string path." );
    } else {
      logger.debug( "Inlining imports on [[ " + fileName + " ]]" );
      file.outputFileText = inlineCSSimport( file.inputFileName, text );
    }

    if ( i === options.files.length - 1 ) {
      next();
    }

  });
};

exports.registration = function ( config, register ) {
  if ( config.isOptimize || config.isMinify ) {
    logger = config.log;
    var e = config.extensions;
    register( ["add","update","buildExtension", "buildFile"], "beforeWrite", _inlineCSSimport, e.css );
  }
};
