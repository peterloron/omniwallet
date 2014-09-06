angular.module('omniwallet')
  .factory('enumerated_addresses', function($http, $q, $timeout, $injector) {
    var count = 1;
    return {
      "getData": function() {
        var deferred = $q.defer();

        _.defer(function() {
          var wallet = $injector.get('userService').getWallet();
          if (wallet && wallet.addresses.length > 0) {

            deferred.resolve({
              addresses: wallet.addresses
            });
          } else {
            deferred.resolve({
              addresses: []
            });
          }
        });
        return deferred.promise;
      }
    };
  })
  .controller('AddAddressController', function($modal, $injector, $scope, userService, enumerated_addresses) {

  function decodeAddressFromPrivateKey(key) {

    //  Return the address decoded from the private key.
    var eckey = new Bitcoin.ECKey(key);
    var addr = eckey.getBitcoinAddress().toString();

    return addr;
  };

  function encodePrivateKey(key, passphrase) {

    //  Return encoded key.  Forget the passphrase forever.
    var eckey = new Bitcoin.ECKey(key);
    var enc = eckey.getEncryptedFormat(passphrase);

    return enc;
  };

  $scope.backupWallet = function() {
    $scope.login = {
      uuid: userService.data.wallet.uuid,
      action: 'verify',
      title: 'Verify Account',
      button: 'Validate',
      disable: true //disable UUID field in template
    };
    var modalInstance = $modal.open({
      templateUrl: '/partials/login_modal.html',
      controller: LoginController,
      scope: $scope
    });

    modalInstance.result.then(function(wallet) {
      $scope.exportData = {
        backupName : wallet.uuid,
        exportPrivate : true,
        exportWatch : true
      };
      $scope.exportInProgress=false;
      var exportModalInstance = $modal.open({
        templateUrl: '/partials/export_wallet.html',
        controller: function($scope, $modalInstance, wallet){
          $scope.exportWallet = function(exportData){
            $scope.exportInProgress=true;
            var walletAddresses = wallet.addresses;
            var blob = {
              addresses: []
            };
            walletAddresses.forEach(function(obj) {
              if(exportData.exportPrivate && obj.privkey) {
                var ecKey = Bitcoin.ECKey.decodeEncryptedFormat(obj.privkey, obj.address);
                var addr = ecKey.getBitcoinAddress().toString();
                var key = ecKey.getWalletImportFormat();
                blob.addresses.push({ address: addr, privkey: key });
              }
              if(exportData.exportWatch && !obj.privkey) {
                blob.addresses.push({ address: obj.address, privkey: "" });
              }
            });
            var exportBlob = new Blob([JSON.stringify(blob)], {
              type: 'application/json;charset=utf-8'
            });
            fileName=exportData.backupName+".json";
            saveAs(exportBlob, fileName);
            
            $modalInstance.close(fileName);
          };
        },
        scope: $scope,
        resolve:{
          wallet: function(){
            return wallet;
          }
        }
      });
    });
  };

  // Begin Import watch only Form Code
  $scope.openImportWatchOnlyForm = function() {
    var modalInstance = $modal.open({
      templateUrl: '/partials/import_watch_only.html',
      controller: AddBtcAddressModal
    });

    modalInstance.result.then(function(result) {

      if (result.address) {
        $injector.get('userService').addAddress(result.address);
      }
      $scope.refresh();
      $scope.addedNewAddress = true;
      $scope.createdAddress = result.address;
    }, function() {});
  };

  var AddBtcAddressModal = function($scope, $modalInstance) {
    $scope.validate = function(address) {
      return Bitcoin.Address.validate(address);
    };

    $scope.addressNotListed = function(address) {
      var addresses = $injector.get('userService').getAllAddresses();
      for (var i in addresses) {
        if (addresses[i].address == address) {
          return false;
        }
      }

      return true;
    };

    $scope.ok = function(result) {
      if (Bitcoin.Address.validate(result.address))
        $modalInstance.close(result);
      else
        console.log('*** Invalid address: ' + result.address);
    };

    $scope.cancel = function() {
      $modalInstance.dismiss('cancel');
    };
  };
  // Done Import Watch Only Form Code.

  // Begin Import Private Key Form Code
  $scope.openImportPrivateKeyForm = function() {
    var modalInstance = $modal.open({
      templateUrl: '/partials/import_private.html',
      controller: AddPrivateKeyModal
    });

    modalInstance.result.then(function(result) {

      if (result.privKey) {
        // Use address as passphrase for now
        var addr = decodeAddressFromPrivateKey(result.privKey);
        $injector.get('userService').addAddress(
        addr,
        encodePrivateKey(result.privKey, addr));
      }
      $scope.refresh();
      $scope.addedNewAddress = true;
      $scope.createdAddress = decodeAddressFromPrivateKey(result.privKey);
    }, function() {});
  };

  var AddPrivateKeyModal = function($scope, $modalInstance) {
    $scope.validate = function(address) {
      if (!address) return false;

      try {
        var eckey = new Bitcoin.ECKey(address);
        var addr = eckey.getBitcoinAddress().toString();
        return true;
      } catch (e) {
        return false;
      }
    };

    $scope.ok = function(result) {
      $modalInstance.close(result);
    };

    $scope.cancel = function() {
      $modalInstance.dismiss('cancel');
    };
  };
  // Done Import Private Key Form Code.
  // Begin Import Encrypted Key Form Code
  $scope.openImportEncryptedKeyForm = function() {
    var modalInstance = $modal.open({
      templateUrl: '/partials/import_encrypted_private.html',
      controller: AddEncryptedPrivateModal
    });

    modalInstance.result.then(function(result) {

      if (result.encryptedPrivKey && result.password) {
        // Decrypt key then store with default password of addr
        var key = Bitcoin.ECKey.decodeEncryptedFormat(result.encryptedPrivKey, result.password);
        var privkey = Bitcoin.Util.bytesToHex(key.getPrivateKeyByteArray());
        // Use address as passphrase for now
        var addr = decodeAddressFromPrivateKey(privkey);
        $injector.get('userService').addAddress(
        addr,
        encodePrivateKey(privkey, addr));
      }
      $scope.refresh();

    }, function() {});
  };

  var AddEncryptedPrivateModal = function($scope, $modalInstance) {
    $scope.ok = function(result) {
      $modalInstance.close(result);
    };

    $scope.cancel = function() {
      $modalInstance.dismiss('cancel');
    };
  };
  // Done Import Encrypted Private Key Code.

  // Begine Create Form Code.
  $scope.createBTCAddress = createBTCAddress;
  function createBTCAddress() {
    var ecKey = new Bitcoin.ECKey();
    var address = ecKey.getBitcoinAddress().toString();
    var encryptedPrivateKey = ecKey.getEncryptedFormat(address);
    $injector.get('userService').addAddress(address, encryptedPrivateKey);
    $scope.refresh();
    $scope.addedNewAddress = true;
    $scope.createdAddress = address;
  }
  ;
  // Done Create Form Code.
  // Begin Import Backup Form Code
  $scope.openImportWalletForm = function() {
    var modalInstance = $modal.open({
      templateUrl: '/partials/import_wallet.html',
      controller: ImportWalletModal
    });

    modalInstance.result.then(function(result) {

      if (result) {
        var wallet = JSON.parse(result);
        
        wallet.addresses.forEach(function(addr){
          // Use address as passphrase for now
          if(addr.privkey) 
            $injector.get('userService').addAddress(
              addr.address,
              encodePrivateKey(addr.privkey, addr.address));
          else
            $injector.get('userService').addAddress(
              addr.address);   
        });
      }
      $scope.refresh();

    });
  };

  var ImportWalletModal = function($scope, $modalInstance) {
    $scope.validate = function(backup) {
      if (!backup) return false;

      try {
        var wallet = JSON.parse(backup);
        var isValid = true;
        wallet.addresses.forEach(function(address){  
          if(address.privkey){
            var eckey = new Bitcoin.ECKey(address.privkey);
            var addr = eckey.getBitcoinAddress().toString();
            isValid = isValid && Bitcoin.Address.validate(addr);
          }
          else
            isValid = isValid && Bitcoin.Address.validate(address.address);
        });
        return isValid;
      } catch (e) {
        return false;
      }
    };

    $scope.ok = function(result) {
      $modalInstance.close(result);
    };

    $scope.cancel = function() {
      $modalInstance.dismiss('cancel');
    };
  };
  // Done Import Import Backup Form Code.
  


  $scope.enumerateAddresses = function() {

    $scope.items = enumerated_addresses.getData().then(function(result) {
      if (result.addresses.length == 0) {
        createBTCAddress();
	$scope.newAddress=true;
      }
      $scope.addresses = result.addresses;
    });
  };


});



