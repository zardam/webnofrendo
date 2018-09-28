"use strict";

angular.module('webnofrendo', []).controller('main', function($scope, $http) {
  $scope.text = 'Hello World !';
  $scope.webUSB = typeof navigator.usb !== 'undefined';

  var appendBuffer = function(buffer1, buffer2) {
    var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
  };

  $http.get("epsilon.bin", {responseType: "arraybuffer"}).
    then(function(response) {
      console.log(response);
      $scope.firmware = response.data;
    }, function(error) {
      console.log(error);
      $scope.error = "Unable to load firmware";
  });

  $scope.getFile = function (el) {
     let file = el[0].files[0];
     let reader = new FileReader();

       reader.addEventListener("load", function () {
         $scope.rom = reader.result;
         console.log($scope.rom);
       }, false);

       $scope.$apply(function() {
       if (file) {
         console.log("loading", file);
         $scope.romFileName = file.name;
         reader.readAsArrayBuffer(file);
       } else {
         delete $scope.romFileName;
       }});
   };

  $scope.connect = function() {
    delete $scope.error;
    navigator.usb.requestDevice({ filters: [{ vendorId: 0x0483, productId: 0xdf11 }] }).then(
       async selectedDevice => {
            console.log("selected device", selectedDevice);
            let interfaces = dfu.findDeviceDfuInterfaces(selectedDevice);
            console.log("interfaces", interfaces);
            if (interfaces.length == 0) {
                throw "The selected device does not have any USB DFU interfaces.";
            }
            interfaces[0].name = "@Internal Flash /0x08000000/04*016Kg,01*064Kg,07*128Kg";
            let device = new dfuse.Device(selectedDevice, interfaces[0]);
            console.log("device", device);
            await device.open();
            try {
                let status = await device.getStatus();
                if (status.state == dfu.dfuERROR) {
                    await device.clearStatus();
                }
            } catch (error) {
                console.log("Failed to clear status");
            }
            device.logProgress = function(done, total) {
              console.log("progress", done, total);
            }
            device.logDebug = function(message) {
              console.log("debug", message);
            }
//            device.startAddress = 0x08000000;
            try {
            await device.do_download(2048, appendBuffer($scope.firmware, $scope.rom), false).then(
                () => {
                  console.log("done");
                },
                error => {
                  throw error;
                }
            )} catch(e) {
              console.log(e);
            }
            console.log("finished");
        }
    ).catch(error => {
      $scope.$apply(function() {
        $scope.error = error;
      });
    });
  };
}).directive("ngFileSelect",function(){
  return {
    link: function($scope,el){
      el.bind("change", function(e){
        $scope.getFile(el);
      })
    }
  }
});
