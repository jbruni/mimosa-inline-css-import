"use strict";

exports.defaults = function() {
  return {
    inlineCSSimport: {
      exclude:[]
    }
  };
};


exports.placeholder = function () {
  var ph = "\n  inlineCSSimport:              # Configuration for inlining imported CSS stylesheets\n" +
     "    exclude:[]                  # List of string paths and regexes to match files to exclude\n" +
     "                                # the search for @import clauses and respective inlining. \n" +
     "                                # Paths can be relative to the watch.compiledDir, or absolute. \n" +
     "                                # Paths are to compiled files,  so '.css' rather than '.styl'\n\n";

  return ph;
};

exports.validate = function( config, validators )  {
  var errors = [];
  if ( validators.ifExistsIsObject( errors, "inlineCSSimport config", config.inlineCSSimport ) ) {
    validators.ifExistsFileExcludeWithRegexAndString( errors, "inlineCSSimport.exclude", config.inlineCSSimport, config.watch.compiledDir );
  }
  return errors;
};
