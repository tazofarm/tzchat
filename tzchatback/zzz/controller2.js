module.exports = function(app){
    app.get("/test2",function(req,res){
        res.send("test2");
    });

    app.get("/test3",function(req,res){
        res.send("test3");
    });
/*
    app.get("/test4",function(req,res){
        //res.send("test3");

        var html= "<!"
        res.send(html);
    });

*/


};