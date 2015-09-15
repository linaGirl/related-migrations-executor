!function () {
    'use strict';
    var Class = require('ee-class')
        , ORM = require('related')
        , EventEmitter = require('ee-event-emitter')
        , fs = require('fs')
        , path = require('path')
        , semver = require('semver')
        , Promise = require('promise')
        , sqlFiles = []
        , schemaDirs = []
        , filesLength
        , ormObject
        , error;

    module.exports = new Class({
        inherits: EventEmitter
        , config: {}
        , init: function (options) {
            this.config = options;
        }

        /**
         *@param {String} file
         */
        , _getSchemaDirectories: function _getSchemaDirectories(file) {
            return new Promise(function (resolve, reject) {
                fs.stat(file, function (err, stats) {
                    if (err) {
                        reject(err);
                    } else {
                        if (stats && stats.isDirectory() && path.basename(file)[0] !== '.') {
                            if (!semver.valid(file)) {
                                resolve(file);
                            }
                        }
                    }
                });
            });
        }

        /**
         *@param {String} file
         */
        , _getSqlFiles: function _getSqlFiles(file) {
            return new Promise(function (resolve, reject) {
                fs.stat(file, function (err, stats) {
                    if (err) {
                        reject(err);
                    } else {
                        if (stats && !stats.isDirectory() && path.extname(file) === '.sql') {
                            resolve(file);
                        }
                    }
                });
            });
        }

        /**
         *@param {String} file
         */
        , _readSqlFromFile: function _readSqlFromFile(file) {
            var sqlStatements;
            return new Promise(function (resolve, reject) {
                fs.readFile(file, function (err, fileContent) {
                    if (err) {
                        reject(err);
                    } else {
                        sqlStatements = fileContent.toString().split(';').map(function (input) {
                            return input.trim().replace(/\n/gi, ' ').replace(/\s{2,}/g, ' ');
                        }).filter(function (item) {
                            return item.length;
                        });
                        resolve(sqlStatements);
                    }
                });
            });
        }

        /**
         *@param ormObject
         *@param sqlStatments
         */
        , _executeSqlStatements: function _executeSqlStatements(ormObject, sqlStatements) {
            // Todo: Execute sql statements
        }



        /**
         * Return all schema version directories
         *
         * @param {String} migrationPath
         * @param {Function} callback
         */
        , _readSchemaDir: function (migrationPath, callback) {

            fs.readdir(migrationPath, function (err, files) {
                if (err) callback(err);
                else {

                    if (!files.length) callback(null, schemaDirs);
                    else {
                        Promise.all(files.map(function (file) {
                            return path.resolve(migrationPath, file);
                        }).map(this._getSchemaDirectories.bind(this))).done(function (response) {
                            callback(null, response);
                        }, function (err) {
                            callback(err);
                        });
                    }
                }
            }.bind(this));
        }





        /**
         * Return all sql files
         * @param {String} versionPath
         * @param {Function} callback
         */
        , _readSqlFiles: function _readSqlFiles(versionPath, callback) {
            fs.readdir(versionPath, function (err, files) {
                if (err) {
                    callback(err);
                } else {
                    filesLength = files.length;
                    if (!filesLength) {
                        callback(null, sqlFiles);
                    } else {
                        Promise.all(files.map(function (file) {
                            return file = path.resolve(versionPath, file);
                        }).map(this._getSqlFiles.bind(this))).done(function (response) {
                            callback(null, response);
                        }, function (err) {
                            callback(err);
                        });
                        ;
                    }
                }
            }.bind(this));
        }

        /**
         * Migrate all sql files of schema version
         * @param {Function} callback
         */
        , migrate: function migration(callback) {
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
                        this._readSchemaDir(options.migrationPath, function (err, dirs) {
                            if (err) {
                                callback(err);
                            } else {
                                if (!dirs.length) {
                                    error = new Error('No migration found!');
                                    error.name = 'errorEmptyPath';
                                    callback(error);
                                } else {
                                    dirs.forEach(function (dir) {
                                        this._readSqlFiles(dir, function (err, files) {
                                            if (err) {
                                                callback(err);
                                            } else {
                                                if (!files.length) {
                                                    error = new Error('No migration sql found!');
                                                    error.name = 'errorEmptyPath';
                                                    callback(error);
                                                } else {
                                                    Promise.all(files.map(this._readSqlFromFile.bind(this))).done(function (response) {
                                                        this._executeSqlStatements(ormObject, response);
                                                    }.bind(this), function (err) {
                                                        callback(err);
                                                    });
                                                }
                                            }
                                        }.bind(this));
                                    }.bind(this));
                                }
                            }
                        }.bind(this));
                    }

                }
            }.bind(this));

        }
    });
}();