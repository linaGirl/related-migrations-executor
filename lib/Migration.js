!function () {
    'use strict';
    var Class = require('ee-class')
        , ORM = require('related')
        , EventEmitter = require('ee-event-emitter')
        , fs = require('fs')
        , path = require('path')
        , semver = require('semver')
        , Promise = require('promise')
        , async = require("ee-async")
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
         *@param {String} data
         */
        , _getSchemaDirectories: function _getSchemaDirectories(data) {
            return new Promise(function (resolve, reject) {
                fs.stat(data.absolutePath, function (err, stats) {
                    if (err) {
                        reject(err);
                    } else {
                        if (stats && stats.isDirectory() && path.basename(data.absolutePath)[0] !== '.') {
                            if (semver.valid(data.file)) {
                                resolve(data);
                            } else {
                                resolve({});
                            }
                        } else {
                            resolve({});
                        }
                    }
                });
            });
        }

        /**
         *@param {String} data
         */
        , _getSqlFiles: function _getSqlFiles(data) {
            return new Promise(function (resolve, reject) {
                fs.stat(data.absolutePath, function (err, stats) {
                    if (err) {
                        reject(err);
                    } else {
                        if (stats && !stats.isDirectory() && path.extname(data.absolutePath) === '.sql') {
                            resolve(data);
                        } else {
                            resolve({});
                        }
                    }
                });
            });
        }

        /**
         *@param {String} data
         */
        , _readSqlFromFile: function _readSqlFromFile(data) {
            var sqlStatements;
            return new Promise(function (resolve, reject) {
                fs.readFile(data.absolutePath, function (err, fileContent) {
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
         *@param sqlStatements
         *@param callback
         */
        , _executeSqlStatements: function _executeSqlStatements(ormObject, sqlStatements, callback) {
            var dbName = this.config.schema ? this.config.schema : this.config.database
                , ormDatabase = ormObject[dbName];
            if (sqlStatements.length) {
                sqlStatements.forEach(function (data) {
                    ormDatabase.schemaVersion({version: data.version}, ['*']).findOne(function (err, results) {
                        if (err) {
                            callback(err);
                        } else {
                            if (!results) {
                                ormObject.getDatabase(dbName).getConnection(function (err, connection) {
                                    if (err) callback(err);
                                    else {
                                        if (data.data.length) {
                                            async.each(data.data[0], connection.queryRaw.bind(connection), function (err, response) {
                                                if (err) {
                                                    callback(err);
                                                } else {
                                                    new ormDatabase.schemaVersion({version: data.version}).save(callback);
                                                }
                                            });
                                        }

                                    }
                                }.bind(this));
                            } else {
                                var err = new Error('Version already exists');
                                err.name = 'AlreadyExists';
                                callback(err);
                            }
                        }
                    });
                }.bind(this));

            }
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

                    if (!files.length) callback(null, []);
                    else {
                        Promise.all(files.map(function (file) {
                            return {absolutePath: path.resolve(migrationPath, file), file: file};
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
        , _readSqlFiles: function _readSqlFiles(data, callback) {
            if (data.absolutePath) {
                fs.readdir(data.absolutePath, function (err, files) {
                    if (err) {
                        callback(err);
                    } else {
                        filesLength = files.length;
                        if (!filesLength) {
                            callback(null, sqlFiles);
                        } else {
                            Promise.all(files.map(function (file) {
                                return {
                                    absolutePath: path.resolve(data.absolutePath, file),
                                    file: file,
                                    versionName: data.file
                                };
                            }).map(this._getSqlFiles.bind(this))).done(function (response) {
                                callback(null, response);
                            }, function (err) {
                                callback(err);
                            });
                        }
                    }
                }.bind(this));
            } else {
                callback(null)
            }
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
                                    async.each(dirs, function (item, next) {
                                            var schemaDirectoryObject = {version: item.file};
                                            this._readSqlFiles(item, function (err, files) {
                                                if (err) {
                                                    next(err);
                                                } else {
                                                    if (!files) {
                                                        error = new Error('No migration sql found!');
                                                        error.name = 'errorEmptyPath';
                                                        next(error);
                                                    } else {
                                                        Promise.all(files.map(this._readSqlFromFile.bind(this))).done(function (response) {
                                                            schemaDirectoryObject['data'] = response;
                                                            next(null, schemaDirectoryObject);
                                                        }.bind(this), function (err) {
                                                            next(err);
                                                        });
                                                    }
                                                }
                                            }.bind(this));
                                        }.bind(this),
                                        function (err, results) {
                                            if (err) {
                                                callback(err);
                                            } else {
                                                this._executeSqlStatements(ormObject, results, function (err, response) {
                                                    console.log(err, response);
                                                });
                                            }
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