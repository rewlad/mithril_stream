"use strict"

function World(){
  var world = {}
  var tx = null

  function packKey(objId,attrName){ return objId+'.'+attrName }
  function packReverseKey(attrName,value){ return attrName+'='+value }

  function Prop(attrName){
      function run(objIds,args){ return getOrSet(key,flat,unflat,objIds,args) }
      function key(objId){ return packKey(objId,attrName) }
      function unflat(values){
          if(values.length==0) return "";
          if(values.length==1) return values[0] + "";
          throw values
      }
      function flat(value){ return value + "" }
      run.rev = Rev(attrName)
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
      function flat(value){ throw "can not flat" }
      run.toString = function(){ return "Rev<"+attrName+">" }
      return run
  }

  function id(objIds,args){
      if(args.length > 0) throw args
      if(objIds.length==1) return objIds[0]
      throw objIds
  }

  function ids(objIds,args){
      return objIds
  }

  function getOrSet(key,flat,unflat,objIds,args){
    function set(){
      if(objIds.length==1) return tx.changes[key(objIds[0])] = flat(args[0]);
      throw objIds
    }
    if(args.length > 0){
      if(!tx) return rwTx(function(){ set() })
      if(tx.changes) return set()
      throw "ro tx"
    }
    return unflat(objIds.map(function(objId){
        var k = key(objId)
        if(!tx) throw "out of tx"
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

  function doTx(ini,f){
    if(tx) throw "nested tx is not supported"
    tx = { changes:ini }
    try {
      return f()
    } finally {
      tx = null
    }
  }
  function roTx(f){ doTx(null,f) }
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

  function dump(){ console.log(world) }

  return {
    Rel: Rel,
    Prop: Prop,
    id: id,
    newId: newId,
    where: where,
    roTx: roTx,
    rwTx: rwTx,
    dump: dump
  };
}
