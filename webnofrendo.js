"use strict";

angular.module('webnofrendo', []).controller('main', function($scope, $http) {
  $scope.webUSB = typeof navigator.usb !== 'undefined';

  $scope.getFile = function(el) {
    let file = el[0].files[0];
    let reader = new FileReader();

    reader.addEventListener("load", function() {
      $scope.$apply(function() {
        delete $scope.selectedFirmware;
        delete $scope.allDone;
        let dv = new DataView(reader.result,0,3)
        if(dv.getInt8(0) == 'N'.charCodeAt(0) && dv.getInt8(1) == 'E'.charCodeAt(0) && dv.getInt8(2) == 'S'.charCodeAt(0)) {
          $scope.romLoaded = true;
          $scope.rom = reader.result;
          delete $scope.romError;
        } else {
          $scope.romError = 'The file is not a NES ROM'
          delete $scope.romLoaded;
          delete $scope.rom;
        }
      });
      console.log($scope.rom);
    }, false);

    $scope.$apply(function() {
      if (file) {
        console.log("loading", file);
        $scope.romFileName = file.name + ", " + file.size + " bytes";
        reader.readAsArrayBuffer(file);
      } else {
        delete $scope.romLoaded;
        delete $scope.romFileName;
        delete $scope.selectedFirmware;
        delete $scope.romError;
        delete $scope.rom;
        delete $scope.allDone;
      }
    });
  };

  $scope.firmwares = [
    {name: "epsilon-full.bin", desc: "Full PAL: all the stock apps and NES emulator"},
    {name: "epsilon-full-60.bin", desc: "Full NTSC: all the stock apps and NES emulator"},
    {name: "epsilon-medium.bin", desc: "Medium PAL: Calculation, Graph, Python and NES emulator"},
    {name: "epsilon-medium-60.bin", desc: "Medium NTSC: Calculation, Graph, Python and NES emulator"},
    {name: "epsilon-min.bin", desc: "Minimal PAL: only NES emulator"},
    {name: "epsilon-min-60.bin", desc: "Minimal NTSC: only NES emulator"}
  ];

  $scope.firmwares.forEach( f => {
    $http.get(f.name, {responseType: "arraybuffer"})
    .then(function(response) {
      f.data = response.data;
    }, function(error) {
      console.log(error);
      $scope.firmwareError = "Unable to load firmware";
    });
  })

  var appendBuffer = function(buffer1, buffer2) {
    var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
  };

  $scope.upload = function() {
    delete $scope.error;
    navigator.usb.requestDevice({
      filters: [{
        vendorId: 0x0483,
        productId: 0xdf11
      }]
    }).then(
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
          $scope.$apply(function() {
            $scope.progress = (done / total)*100;
          })
        }
        device.logInfo = function(message) {
          console.log(message);
          $scope.$apply(function() {
            $scope.lastAction = message;
          })
        }
        await device.do_download(2048, appendBuffer($scope.selectedFirmware.data, $scope.rom), true).then(
          () => {
            console.log("done");
            $scope.$apply(function() {
              $scope.allDone = true;
            })
          },
          error => {
            throw error;
          }
        )
      }
    ).catch(error => {
      $scope.$apply(function() {
        $scope.error = error;
        delete $scope.allDone;
      });
    });
  };
}).directive("ngFileSelect", function() {
  return {
    link: function($scope, el) {
      el.bind("change", function(e) {
        $scope.getFile(el);
      })
    }
  }
});
