!function () {
    'use strict';
    var Class = require('ee-class')
            , ORM = require('related')
            , EventEmitter = require('ee-event-emitter')
            , fs = require('fs')
            , path = require('path')
            , semver = require('semver')
            , sqlFiles = []
            , schemaDirs = []
            , filesLength
            , sqlStatments
            , ormObject
            , error;

    /**
     * Return all schema version directories 
     * @param <String> migrationPath
     * @param <Function> callback
     */
    function readSchemaDir(migrationPath, callback) {
        fs.readdir(migrationPath, function (err, files) {
            if (err) {
                callback(err);
            }
            filesLength = files.length;
            if (!filesLength) {
                return callback(null, schemaDirs);
            }
            files.forEach(function (file) {
                file = path.resolve(migrationPath, file);
                fs.stat(file, function (err, stats) {
                    if (err) {
                        callback(err);
                    }
                    if (stats && stats.isDirectory() && path.basename(file)[0] !== '.') {
                        if (semver.valid(file)) {
                            schemaDirs.push(file);
                        }
                    }
                    if (!--filesLength) {
                        callback(null, schemaDirs);
                    }
                });
            });
        });
    }

    /**
     * Return all sql files
     * @param <String> versionPath
     * @param <Function> callback
     */
    function  readSqlFiles(versionPath, callback) {
        fs.readdir(versionPath, function (err, files) {
            if (err) {
                callback(err);
            }
            filesLength = files.length;
            if (!filesLength) {
                return callback(null, sqlFiles);
            }
            files.forEach(function (file) {
                file = path.resolve(versionPath, file);
                fs.stat(file, function (err, stats) {
                    if (err) {
                        callback(err);
                    }
                    if (stats && !stats.isDirectory() && path.extname(file) === '.sql') {
                        sqlFiles.push(file);
                    }
                    if (!--filesLength) {
                        callback(null, sqlFiles);
                    }
                });
            });
        });
    }

    module.exports = new Class({
        inherits: EventEmitter
        , config: {}
        , init: function (options) {
            this.config = options;
        }
        /**
         * Migrate all sql files of schema version
         * @param <Function> callback
         */
        , migrate: function (callback) {
            var options = this.config
                    , ormDatabase;
            ormObject = new ORM(options.user
                    , options.password
                    , options.host
                    , options.schema
                    , options.database
                    , options.type);

            ormObject.load(function (err) {
                if (err) {
                    callback(err);
                } else {
                    ormDatabase = ormObject[options.schema];
                    if (!ormDatabase) {
                        error = new Error('Database doesn\'t exists');
                        error.name = 'errorNotFound';
                        callback(error);
                    } else if (!ormDatabase.schemaVersion) {
                        error = new Error('Table schemaVersion doesn\'t exists');
                        error.name = 'errorNotFound';
                        callback(error);
                    } else if (!fs.existsSync(options.migrationPath)) {
                        error = new Error('Migration path doesn\'t exists');
                        error.name = 'InvalidPath';
                        callback(error);
                    } else {
                        readSchemaDir(options.migrationPath, function (err, dirs) {
                            if (err) {
                                callback(err);
                            }
                            if (!dirs.length) {
                                error = new Error('No migration found!');
                                error.name = 'errorEmptyPath';
                                callback(error);
                            } else {
                                dirs.forEach(function (dir) {
                                    readSqlFiles(dir, function (err, files) {
                                        if (err) {
                                            callback(err);
                                        }
                                        if (!files.length) {
                                            error = new Error('No migration sql found!');
                                            error.name = 'errorEmptyPath';
                                            callback(error);
                                        } else {

                                            files.forEach(function (file) {
                                                sqlStatments = fs.readFileSync(file).toString().split(';').map(function (input) {
                                                    return input.trim().replace(/\n/gi, ' ').replace(/\s{2,}/g, ' ');
                                                }).filter(function (item) {
                                                    return item.length;
                                                });
                                                
                                            });
                                        }
                                    });
                                });
                            }
                        });

                    }

                }
            });

        }});
}();