var Migration = require('./index');
//var tool = new PgTools();
//        tool.dumpDatabase({
//            host: 'localhost'
//            , port: 5432
//            , user: 'postgres'
//            , password: 'navalarti'
//            , dumpPath: dumpSqlFileName
//            , database: 'arunav'
//        },function(error, output, message,filename){
//            
//            if(error instanceof Error) throw error;
//           console.log(output);
//            console.log(message);
//        }); 


var mg = new Migration(
        {
            host: 'localhost'
            , user: 'root'
            , password: 'root'
            , database: 'test'
            , port: 3306
            ,schema:'test'
        }
);
console.log(mg);
mg.migrate(__dirname,function(err,files){
console.log(err,files);    
})


