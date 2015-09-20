"use strict"

function World(){
  var world = {}
  var tx = null

  function packKey(objId,attrName){ return objId+'.'+attrName }
  function packReverseKey(attrName,value){ return attrName+'='+value }

  function Error(arg,msg){
    if(!msg) msg = 'Error';
    this.toString = function(){ return msg+' - '+arg.toString()}
  }

  function Prop(attrName){
      function run(objIds,args){ return getOrSet(key,flat,unflat,objIds,args) }
      function key(objId){ return packKey(objId,attrName) }
      function unflat(values){
          if(values.length==0) return "";
          if(values.length==1) return values[0] + "";
          throw new Error(values)
      }
      function flat(value){ return value + "" }
      run.rev = Rev(attrName)
      run.rel = Rel(attrName)
      return run
  }

  function Rel(attrName){
      function run(objIds,args){ return getOrSet(key,flat,unflat,objIds,args) }
      function key(objId){ return packKey(objId,attrName) }
      function unflat(values){
          var valueIds = values.filter(function(valueId){
              return valueId
          })
          return Obj(valueIds)
      }
      function flat(value){
        return value ? value(id)() : value
      }
      run.rev = Rev(attrName)
      return run
  }

  function Rev(attrName){
      function run(objIds,args){ return getOrSet(key,flat,unflat,objIds,args) }
      function key(objId){ return packReverseKey(attrName,objId) }
      function unflat(values){
          var valueIds = []
          values.forEach(function(h){
              if(h) for(var valueId in h) if(h[valueId]) valueIds.push(valueId)
          })
          return Obj(valueIds)
      }
      function flat(value){ throw new Error(value,"can not flat") }
      run.toString = function(){ return "Rev<"+attrName+">" }
      return run
  }

  function Act(act){           // attrName may be needed for server render
    function run(objIds,args){ // may be args are out of concept here?
      return rwTx(function(){ return act(Obj(objIds), args[0]) })
    }
    return run
  }

  /*
    var size = env.Prop("size")
    var volume = env.Prop("volume")

    env.where("2x2")(size)()(env.and)( env.where("2ml")(volume)() )

    env.and( env.where("2x2")(size)(), env.where("2ml")(volume)() )

    size2x2Obj(env.eq)

    ...()(sizeEq)("2x2").list()
  */

  function and(aObjs,bObjs){
    var aObjIds = aObjs(ids)().slice().sort()
    var bObjIds = bObjs(ids)().slice().sort()
    return Obj(arrayIntersect(aObjIds, bObjIds))
  }

  function arrayIntersect(a, b){
    var ai=0, bi=0;
    var result = [];
    while( ai < a.length && bi < b.length ){
     if      (a[ai] < b[bi] ){ ai++; }
     else if (a[ai] > b[bi] ){ bi++; }
     else if (a[ai] === b[bi]){
       result.push(a[ai]);
       ai++;
       bi++;
     } else throw new Error("not compatible arrays")
    }
    return result;
  }



  /*
  function Filter(attrDef){
    function run(objIds,args){
      return Obj(objIds.filter(function(objId){ return Obj([objId])(attrDef)() == args[0] }))
    }
    return run
  }

  function eq(objIds,args){
    if(objIds.length !== thatObjIds.length) return false;
    for(var i=0;i<objIds.length;i++) if(objIds[i]!==thatObjIds[i]) return false;
    return true;
  }
  */

  function id(objIds,args){
      if(args.length > 0) throw new Error(args)
      if(objIds.length==1) return objIds[0]
      throw new Error( objIds )
  }

  function ids(objIds,args){
      return objIds
  }

  function getOrSet(key,flat,unflat,objIds,args){
    function set(){
      if(objIds.length==1) return tx.changes[key(objIds[0])] = flat(args[0]);
      throw new Error( objIds )
    }
    if(args.length > 0){
      if(!tx) return rwTx(function(){ set() })
      if(tx.changes) return set()
      throw new Error(tx, "ro tx")
    }
    return unflat(objIds.map(function(objId){
        var k = key(objId)
        if(!tx) throw new Error(tx, "out of tx")
        return world[k]
    }))
  }

  function Attr(objIds, attrDef){
    function recv(value){ return attrDef(objIds,arguments) }
    recv.toString = function(){ return "Attr<"+objIds.join(",")+"> "+attrDef }
    return recv
  }

  function Obj(objIds){
    function recv(attrDef){ return Attr(objIds, attrDef) }
    recv.toString = function(){ return "Obj<"+objIds.join(",")+">" }
    recv.list = function list(){ return objIds.map(function(objId){ return Obj([objId]) }) }
    return  recv
  }

  function newId(){ return (Math.random()+"").substr(2) }
  function where(value){ return Obj([value]) }
  function none(){ return Obj([]) }

  function doTx(ini,f){
    if(tx) throw new Error(tx,"nested tx is not supported")
    tx = { changes:ini }
    try {
      return f()
    } finally {
      tx = null
    }
  }
  function roTx(f){ return doTx(null,f) }
  function rwTx(f){
      function index(key,on){
          var dot = key.indexOf(".")
          var objId = key.substr(0,dot)
          var attrName = key.substr(dot+1)
          var value = world[key]
          var reverseKey = packReverseKey(attrName,value)
          if(!world[reverseKey]) world[reverseKey] = {}
          world[reverseKey][objId] = on
      }
      doTx({},function(){
        f()
        for(var key in tx.changes){
            if(key in world) index(key,false)
            world[key] = tx.changes[key]
            index(key,true)
        }
      })
  }

  function exportEach(f){
    var keys=[];
    for(var key in world){
      var equ = key.indexOf("=");
      if(equ !== -1) continue;
      keys.push(key);
    };
    keys.sort();
    var len = keys.length;

    for(var i = 0; i < len; i++){
      var dot = keys[i].indexOf(".");
      var objId = keys[i].substr(0,dot);
      var attrName = keys[i].substr(dot+1);
      var value = world[keys[i]];

      f(objId,attrName,value);
    }
  }

  function dump(){ console.log(world) }

  return {
    Rel: Rel,
    Prop: Prop,
    Act: Act,
    id: id,
    newId: newId,
    where: where,
    and: and,
    none: none,
    roTx: roTx,
    rwTx: rwTx,
    exportEach: exportEach,
    dump: dump
  };
}