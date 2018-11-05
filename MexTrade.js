'use strict'
const request = require("request");
const BFX = require('bitfinex-api-node')
const MEX = require('bitmex-realtime-api');
const crypto = require('crypto');

const apiKey = "";
const apiSecret = "";

const mex = new MEX({
  testnet: false,
  apiKey: apiKey,
  apiSecret: apiSecret,
  ws: {
    autoReconnect: true,
    seqAudit: true,
    packetWDDelay: 10 * 1000
  }
})

const tp = 0.065;

var orderChecks= 0 ;




function MexTrade(){
  this.prices={};

  mex.on('error', console.error);
  mex.on('open', () => console.log('Connection opened.'));
  mex.on('close', () => console.log('Connection closed.'));
  mex.on('initialize', () => console.log('Client initialized, data is flowing.'));

  // mex.open();
  //
  // setInterval(function(){
  //   console.log("Restarting websockets");
  //   mex.close();
  //   mex.open();
  // }, 2*60*60*1000)
}

MexTrade.prototype.getBalance = function(callback){
  var self = this;

  var verb = 'GET',
    path = '/api/v1/user/margin',
    expires = new Date().getTime() + (60 * 1000), // 1 min in the future
    data = {currency:"XBt"};

  var postBody = JSON.stringify(data);
  var signature = crypto.createHmac('sha256', apiSecret).update(verb + path + expires + postBody).digest('hex');
  var headers = {
    'content-type' : 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'api-expires': expires,
    'api-key': apiKey,
    'api-signature': signature
  };

  const requestOptions = {
    headers: headers,
    url:'https://www.bitmex.com'+path,
    method: verb,
    body: postBody
  };

  request(requestOptions, function(error, response, body){
    if(!error){
      var wallet = JSON.parse(body); // convert to JSON
      //console.log('Wallet Balance ', (wallet["walletBalance"]) / 100000000, " Last Price, ", self.prices["lastPrice"] );
      //console.log(' Wallet Balance', wallet);
      var btcBalance = (wallet["walletBalance"]) / 100000000; // Convert Satoshis to BTC
      return callback(btcBalance);
      }else{
        console.log('Error occured when requesting balance, MexTrade');
        console.log(error.toString());
        setTimeout(function(){
          self.getBalance(callback);
        }, 3000)
      }
  });
}

MexTrade.prototype.getPosition = function(callback){
  var self = this;

  var verb = 'GET',
    path = '/api/v1/position',
    expires = new Date().getTime() + (60 * 1000), // 1 min in the future
    data = {symbol:"XBTUSD"};
  var postBody = JSON.stringify(data);
  var signature = crypto.createHmac('sha256', apiSecret).update(verb + path + expires + postBody).digest('hex');
  var headers = {
    'content-type' : 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'api-expires': expires,
    'api-key': apiKey,
    'api-signature': signature
  };

  const requestOptions = {
    headers: headers,
    url:'https://www.bitmex.com'+path,
    method: verb,
    body: postBody
  };

  request(requestOptions, function(error, response, body) {
    if(!error){
      //console.log('Get Position length ', body.length, body);
      if (body.length > 3){
        var position = JSON.parse(body.slice(1, -1)); // remove brackets and convert to JSON
        if(position['symbol'] == "XBTUSD"){
          console.log("Active position ", position["currentQty"], " from ", position["avgEntryPrice"], " Last Price ", self.prices["lastPrice"]);
          return callback(position["avgEntryPrice"], position["currentQty"]);
        }else{
          console.log("No active Positions.");
        }
      }
      else{
        console.log("No active Positions.");
      }
    }else{
      console.log('Error occured when requesting Active Positions');
      console.log(error.toString());
      setTimeout(function(){
        self.getPosition(callback);
      },3000)
    }
  });

}


MexTrade.prototype.getOrders = function(orderID, callback){
  var self = this;

  var verb = 'GET',
    path = '/api/v1/order',
    expires = new Date().getTime() + (60 * 1000), // 1 min in the future
    data = {reverse:true};
  var postBody = JSON.stringify(data);
  var signature = crypto.createHmac('sha256', apiSecret).update(verb + path + expires + postBody).digest('hex');
  var headers = {
    'content-type' : 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'api-expires': expires,
    'api-key': apiKey,
    'api-signature': signature
  };

  const requestOptions = {
    headers: headers,
    url:'https://www.bitmex.com'+path,
    method: verb,
    body: postBody
  };

  request(requestOptions, function(error, response, body) {
    if(!error){
      //console.log('Get Position length ', body.length, body);
      if (body.length > 3){
        var orders = JSON.parse(body); // remove brackets and convert to JSON
        console.log("Getting Orders ID ", orderID)
        for (var order of orders){
          if (order["orderID"] == orderID){
            return callback(order["ordStatus"])
          }else{
            console.log("Order ID Not Found")
          }
        }console.log("No matching orders")
        return callback()
      }
      else{
        console.log("No Orders.");
      }
    }else{
      console.log('Error occured when requesting Orders');
      console.log(error.toString());
      setTimeout(function(){
        self.getOrders(callback);
      },3000)
    }
  });

}

MexTrade.prototype.getHistBucket = function(callback){
  var self = this;

  var verb = 'GET',
    path = '/api/v1/trade/bucketed',
    expires = new Date().getTime() + (60 * 1000), // 1 min in the future
    data = {binSize: "1h", partial:false, symbol: "XBTUSD", count: 60, reverse:true};
  var postBody = JSON.stringify(data);
  var signature = crypto.createHmac('sha256', apiSecret).update(verb + path + expires + postBody).digest('hex');
  var headers = {
    'content-type' : 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'api-expires': expires,
    'api-key': apiKey,
    'api-signature': signature
  };

  const requestOptions = {
    headers: headers,
    url:'https://www.bitmex.com'+path,
    method: verb,
    body: postBody
  };

  request(requestOptions, function(error, response, body) {
    if(!error){
      //console.log('Get Position length ', body.length, body);
      if (body.length > 3){
        return callback(JSON.parse(body))
      }else{
        console.log("No Historical buckets")
        return callback(false)
      }
    }else{
      console.log('Error occured when getting Historical buckets');
      console.log(error.toString());
      return callback(false)
    }
  });

}

MexTrade.prototype.getBucket = function(callback){
  var self = this;

  var verb = 'GET',
    path = '/api/v1/trade/bucketed',
    expires = new Date().getTime() + (60 * 1000), // 1 min in the future
    data = {binSize: "1h", partial:true, symbol: "XBTUSD", count: 1, reverse:true};
  var postBody = JSON.stringify(data);
  var signature = crypto.createHmac('sha256', apiSecret).update(verb + path + expires + postBody).digest('hex');
  var headers = {
    'content-type' : 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'api-expires': expires,
    'api-key': apiKey,
    'api-signature': signature
  };

  const requestOptions = {
    headers: headers,
    url:'https://www.bitmex.com'+path,
    method: verb,
    body: postBody
  };

  request(requestOptions, function(error, response, body) {
    if(!error){
      //console.log('Get Position length ', body.length, body);
      if (body.length > 3){
        var buckets = JSON.parse(body); // remove brackets and convert to JSON
        for (var bucket of buckets){
            return callback(bucket["high"], bucket["low"], bucket["open"], bucket["timestamp"])
          }
        }else{
        console.log("No buckets")
        return callback(false)
      }
    }else{
      console.log('Error occured when getting bucket');
      console.log(error.toString());
      return callback(false)
    }
  });

}

MexTrade.prototype.getPrices= function(){
  var self = this;

  mex.addStream('XBTUSD', 'instrument', function(data, symbol, tableName) {
    //console.log(`Got update for ${tableName}:${symbol}. Current state:\n${JSON.stringify(data).slice(0, 100)}...`);
    if(!self.prices.hasOwnProperty("lastPrice")){
      self.prices={lastPrice: -Infinity}
    }
    self.prices["lastPrice"] = data[0]["lastPrice"];
    self.prices["bid"] = data[0]["bidPrice"];
    self.prices["ask"] = data[0]["bidPrice"];
    //console.log(data)
    // console.log('XBT Last price, ', self.prices["lastPrice"], data[0]["lastPrice"] );
    // console.log('XBT Bid price, ', self.prices["bidPrice"], data[0]["bidPrice"] );
    // console.log('XBT Ask price, ', self.prices["askPrice"], data[0]["bidPrice"]);
  })

}

MexTrade.prototype.getHistData = function(whichBfxPair, callback){
  var currDate = Date.now()/1000;
  var startDate = (3600 - currDate %3600 + currDate - 301*3600)*1000;
  var url ="https://api.bitfinex.com/v2/candles/trade:1h:t"+whichBfxPair+"/hist?sort=1&limit=300&start="+startDate;

  request({url:url, method :"GET", timeout: 15000}, function(err, response, body){
    if(!err){
      return callback(whichBfxPair, JSON.parse(body));
    }else{
      console.log(err.toString());
    }
  });
}

MexTrade.prototype.getLastCandle = function(whichBfxPair, callback){
  var currDate = Date.now()/1000;
  var startDate = (3600 - currDate %3600 + currDate - 1*3600)*1000;
  var url ="https://api.bitfinex.com/v2/candles/trade:1h:t"+whichBfxPair+"/hist?sort=1&limit=1&start="+startDate;

  request({url:url, method :"GET", timeout: 15000}, function(err, response, body){
    if(!err){
      return callback(whichBfxPair, JSON.parse(body));
    }else{
      console.log(err.toString());
    }
  });
}

// IMPORTANT, probably change ordType to Market and remove ParticipateDoNotInitiate unless you have a better solution to when to market and when to limit.
// The cases where limits at bid/ask don't get hit will kill profitability, but there must be a way to use limits sometimes.

MexTrade.prototype.trade = function(amount, attemptPrice, action, orderSide, BTCAmount, afterPivot, callback){
  var self = this;
  orderChecks = 0 ;

  var verb = 'POST',
    path = '/api/v1/order',
    expires = new Date().getTime() + (60 * 1000), // 1 min in the future
    data = {symbol:"XBTUSD", side: orderSide, orderQty: amount , price : attemptPrice, ordType:"Limit", execInst: "ParticipateDoNotInitiate"};
    //data = {symbol:"XBTUSD", side: orderSide, orderQty: amount , price : attemptPrice, ordType:"Market"};

  var postBody = JSON.stringify(data);
  var signature = crypto.createHmac('sha256', apiSecret).update(verb + path + expires + postBody).digest('hex');
  var headers = {
    'content-type' : 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'api-expires': expires,
    'api-key': apiKey,
    'api-signature': signature
  };

  const requestOptions = {
    headers: headers,
    url:'https://www.bitmex.com'+path,
    method: verb,
    body: postBody
  };

  console.log("Attempt order at price ", attemptPrice, " side ", orderSide, " amount ", amount);

  request(requestOptions, function(error, response, body) {
    if(!error){
      //console.log('Trade response', body);
      var tradeResponse = JSON.parse(body);
      if (!tradeResponse["orderID"]){
        console.log("No Order ID")
        if (orderSide == "Buy"){
          setTimeout(function(){
            attemptPrice = self.prices["bid"];
            self.trade(amount, attemptPrice, action, orderSide, BTCAmount, afterPivot, callback)
          }, 3000);
        }else{
          setTimeout(function(){
            attemptPrice = self.prices["ask"];
            self.trade(amount, attemptPrice, action, orderSide, BTCAmount, afterPivot, callback)
          }, 3000);
        }
      }else{

        setTimeout(function(){
          self.getOrders(tradeResponse["orderID"], function(status){
            if (status){
              if (status == "Canceled"){
                console.log("Instant Cancel Order, ", tradeResponse["orderID"], " Retry")
                if (orderSide == "Buy"){
                  attemptPrice = self.prices["bid"];
                  self.trade(amount, attemptPrice, action, orderSide, BTCAmount, afterPivot, callback)
                }else{
                  attemptPrice = self.prices["ask"];
                  self.trade(amount, attemptPrice, action, orderSide, BTCAmount, afterPivot, callback)
                }
              }else{
                console.log("Order Placed ", tradeResponse["orderID"])

              //   setTimeout(function(){
              //     self.getOrders(tradeResponse["orderID"], function(status){
              //     if (!(status == "Filled")){
              //       self.cancelAll(function(success){
              //         if (success){
              //           if (orderSide == "Buy"){
              //             attemptPrice = self.prices["bid"];
              //             self.trade(amount, attemptPrice, action, orderSide, BTCAmount, afterPivot, callback)
              //           }else{
              //             attemptPrice = self.prices["ask"];
              //             self.trade(amount, attemptPrice, action, orderSide, BTCAmount, afterPivot, callback)
              //           }
              //
              //         }else{
              //           console.log("Manager Debug Error Canceling Orders")
              //         }
              //       })
              //     }else{
              //       console.log("Order was filled id ",tradeResponse["orderID"]);
              //
              //       var stopLossPrice = 0;
              //       var newBTCAmount = 0;
              //       var stopLossAmount = 0;
              //       var takeProfitPrice = 0;
              //       var takeProfitAmount = 0;
              //
              //
              //       //Place Stops and TP for Longs
              //       if (action == "openLong"){
              //         // stopLossPrice = Math.ceil(attemptPrice*0.7);
              //         // newBTCAmount = BTCAmount + (afterPivot * (1/attemptPrice - 1/stopLossPrice))
              //         // stopLossAmount = Math.ceil(newBTCAmount * stopLossPrice) + afterPivot;
              //         // self.placeStopLoss(stopLossAmount, stopLossPrice, "Sell", function(success){
              //         //   if(success){
              //         //     console.log("Placed Stop Loss Sell at ", stopLossPrice)
              //         //   }else{
              //         //     console.log('Error placing Stop Loss');
              //         //   }
              //         // })
              //         //
              //         // setTimeout(function() {
              //         // }, 3000);
              //
              //
              //         takeProfitPrice = Math.ceil(attemptPrice* (1+tp));
              //         newBTCAmount = BTCAmount + (afterPivot * (1/attemptPrice - 1/takeProfitPrice))
              //         takeProfitAmount = Math.ceil(newBTCAmount * takeProfitPrice) + afterPivot;
              //         self.placeTakeProfit(takeProfitAmount, takeProfitPrice, "Sell", function(success){
              //           if(success){
              //             console.log("Placed Take Profit Sell Limit at ", takeProfitPrice)
              //           }else{
              //             console.log('Error placing Take Profit');
              //           }
              //         })
              //       }else if (action == "closeShortPivot"){
              //         // stopLossPrice = Math.ceil(attemptPrice*0.7);
              //         // newBTCAmount = BTCAmount + (afterPivot * (1/attemptPrice - 1/stopLossPrice))
              //         // stopLossAmount = Math.ceil(newBTCAmount * stopLossPrice) + afterPivot;
              //         // self.placeStopLoss(stopLossAmount, stopLossPrice, "Sell", function(success){
              //         //   if(success){
              //         //     console.log("Placed Stop Loss Sell at ", stopLossPrice)
              //         //   }else{
              //         //     console.log('Error placing Stop Loss');
              //         //   }
              //         // })
              //         //
              //         // setTimeout(function() {
              //         // }, 3000);
              //
              //
              //         takeProfitPrice = Math.ceil(attemptPrice* (1+tp));
              //         newBTCAmount = BTCAmount + (afterPivot * (1/attemptPrice - 1/takeProfitPrice))
              //         takeProfitAmount = Math.ceil(newBTCAmount * takeProfitPrice) + afterPivot;
              //         self.placeTakeProfit(takeProfitAmount, takeProfitPrice, "Sell", function(success){
              //           if(success){
              //             console.log("Placed Take Profit Sell Limit at ", takeProfitPrice)
              //           }else{
              //             console.log('Error placing Take Profit');
              //           }
              //         })
              //
              //
              //       }else if (action == "openShort"){
              //         // stopLossPrice = Math.floor(attemptPrice*1.3);
              //         // newBTCAmount = BTCAmount + (afterPivot * (1/stopLossPrice - 1/attemptPrice))
              //         // stopLossAmount = afterPivot - Math.ceil(newBTCAmount * stopLossPrice);
              //         // self.placeStopLoss(stopLossAmount, stopLossPrice, "Buy", function(success){
              //         //   if(success){
              //         //     console.log("Placed Stop Loss Buy at ", stopLossPrice)
              //         //   }else{
              //         //     console.log('Error placing Stop Loss Buy');
              //         //   }
              //         // })
              //         //
              //         // setTimeout(function() {
              //         // }, 3000);
              //
              //
              //         takeProfitPrice = Math.floor(attemptPrice* (1-tp));
              //         newBTCAmount = BTCAmount + (afterPivot * (1/takeProfitPrice - 1/attemptPrice))
              //         takeProfitAmount = afterPivot - Math.ceil(newBTCAmount * takeProfitPrice);;
              //         self.placeTakeProfit(takeProfitAmount, takeProfitPrice, "Buy", function(success){
              //           if(success){
              //             console.log("Placed Take Profit Buy Limit at ", takeProfitPrice)
              //           }else{
              //             console.log('Error placing Take Profit');
              //           }
              //         })
              //
              //       }else if (action == "closeLongPivot"){
              //         // stopLossPrice = Math.ceil(attemptPrice*1.3);
              //         // newBTCAmount = BTCAmount + (afterPivot * (1/stopLossPrice - 1/attemptPrice))
              //         // stopLossAmount = afterPivot - Math.ceil(newBTCAmount * stopLossPrice);
              //         // self.placeStopLoss(stopLossAmount, stopLossPrice, "Buy", function(success){
              //         //   if(success){
              //         //     console.log("Placed Stop Loss Buy at ", stopLossPrice)
              //         //   }else{
              //         //     console.log('Error placing Stop Loss Buy');
              //         //   }
              //         // })
              //         //
              //         // setTimeout(function() {
              //         // }, 3000);
              //
              //
              //         takeProfitPrice = Math.floor(attemptPrice* (1-tp));
              //         newBTCAmount = BTCAmount + (afterPivot * (1/takeProfitPrice - 1/attemptPrice))
              //         takeProfitAmount = afterPivot - Math.ceil(newBTCAmount * takeProfitPrice);
              //         self.placeTakeProfit(takeProfitAmount, takeProfitPrice, "Buy", function(success){
              //           if(success){
              //             console.log("Placed Take Profit Buy Limit at ", takeProfitPrice)
              //           }else{
              //             console.log('Error placing Take Profit');
              //           }
              //         })
              //       }
              //       return callback(true)
              //     }
              //
              //   })
              // }, 900000);
              }

            }else{
              console.log("No status returned from Getting Orders")
            }
          });
        }, 2000);

      }

    }else{
      console.log(error.toString());
      if (orderSide == "Buy"){
        setTimeout(function(){
          attemptPrice = self.prices["bid"];
          self.trade(amount, attemptPrice, action, orderSide, BTCAmount, afterPivot, callback)
        }, 3000);
      }else{
        setTimeout(function(){
          attemptPrice = self.prices["ask"];
          self.trade(amount, attemptPrice, action, orderSide, BTCAmount, afterPivot, callback)
        }, 3000);
      }
    }
  });
}

MexTrade.prototype.placeStopLoss = function(amount, attemptPrice, orderSide, callback){
  var self = this;
  orderChecks = 0 ;

  var verb = 'POST',
    path = '/api/v1/order',
    expires = new Date().getTime() + (60 * 1000), // 1 min in the future
    data = {symbol:"XBTUSD", side: orderSide, orderQty: amount , stopPx : attemptPrice, ordType:"Stop", execInst: "MarkPrice"};

  var postBody = JSON.stringify(data);
  var signature = crypto.createHmac('sha256', apiSecret).update(verb + path + expires + postBody).digest('hex');
  var headers = {
    'content-type' : 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'api-expires': expires,
    'api-key': apiKey,
    'api-signature': signature
  };

  const requestOptions = {
    headers: headers,
    url:'https://www.bitmex.com'+path,
    method: verb,
    body: postBody
  };

  console.log("Attempt Stop Loss order at price ", attemptPrice, " side ", orderSide, " amount ", amount);

  request(requestOptions, function(error, response, body) {
    if(!error){
      var tradeResponse = JSON.parse(body);
      if (!tradeResponse["orderID"]){
        setTimeout(function(){
          self.placeStopLoss(amount, attemptPrice, orderSide, callback)
        }, 3000);
      }else{
        console.log(" Stop loss order was placed id ",tradeResponse["orderID"]);
        return callback(true)
      }
    }else{
      console.log(error.toString());
      return callback(false);
    }
  });
}

MexTrade.prototype.placeTakeProfit = function(amount, attemptPrice, orderSide, callback){
  var self = this;
  orderChecks = 0 ;

  var verb = 'POST',
    path = '/api/v1/order',
    expires = new Date().getTime() + (60 * 1000), // 1 min in the future
    data = {symbol:"XBTUSD", side: orderSide, orderQty: amount , price : attemptPrice, ordType:"Limit", execInst: "ParticipateDoNotInitiate"};

  var postBody = JSON.stringify(data);
  var signature = crypto.createHmac('sha256', apiSecret).update(verb + path + expires + postBody).digest('hex');
  var headers = {
    'content-type' : 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'api-expires': expires,
    'api-key': apiKey,
    'api-signature': signature
  };

  const requestOptions = {
    headers: headers,
    url:'https://www.bitmex.com'+path,
    method: verb,
    body: postBody
  };

  console.log("Attempt Take Profit Limit order at price ", attemptPrice, " side ", orderSide, " amount ", amount);

  request(requestOptions, function(error, response, body) {
    if(!error){
      var tradeResponse = JSON.parse(body);
      if (!tradeResponse["orderID"]){
        setTimeout(function(){
          self.placeTakeProfit(amount, attemptPrice, orderSide, callback)
        }, 3000);
      }else{
        console.log("Take profit limit order was placed id ",tradeResponse["orderID"]);
        return callback(true)
      }

    }else{
      console.log(error.toString());
      return callback(false);
    }
  });
}


function cancelOrder(orderID, callback){

  var self = this;

  var verb = 'DELETE',
    path = '/api/v1/order',
    expires = new Date().getTime() + (60 * 1000), // 1 min in the future
    data = {orderID:orderID};
  var postBody = JSON.stringify(data);
  var signature = crypto.createHmac('sha256', apiSecret).update(verb + path + expires + postBody).digest('hex');
  var headers = {
    'content-type' : 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'api-expires': expires,
    'api-key': apiKey,
    'api-signature': signature
  };

  const requestOptions = {
    headers: headers,
    url:'https://www.bitmex.com'+path,
    method: verb,
    body: postBody
  };

  request(requestOptions, function(error, response, body) {
    if(!error){
      console.log("Order was cancelled ", orderID);
      return callback();
    }else{
      console.log("error occured when cancelling order ", orderID)
      console.log(error.toString());
      setTimeout(function(){
        self.cancelOrder(orderID, callback);
      }, 3000)
    }
  });
}


MexTrade.prototype.cancelAll = function(callback){

  var self = this;

  var verb = 'DELETE',
    path = '/api/v1/order/all',
    expires = new Date().getTime() + (60 * 1000), // 1 min in the future
    data = {};
  var postBody = JSON.stringify(data);
  var signature = crypto.createHmac('sha256', apiSecret).update(verb + path + expires + postBody).digest('hex');
  var headers = {
    'content-type' : 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'api-expires': expires,
    'api-key': apiKey,
    'api-signature': signature
  };

  const requestOptions = {
    headers: headers,
    url:'https://www.bitmex.com'+path,
    method: verb,
    body: postBody
  };

  request(requestOptions, function(error, response, body) {
    if(!error){
      console.log("All Orders cancelled.");
      return callback(true);
    }else{
      console.log("error occured when cancelling all orders")
      console.log(error.toString());
      setTimeout(function(){
        self.cancelAll(callback);
      }, 3000)
    }
  });
}

module.exports = MexTrade;
