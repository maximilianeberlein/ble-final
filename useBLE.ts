/* eslint-disable no-bitwise */
import { useMemo, useState } from "react";
import { PermissionsAndroid, Platform, Vibration } from "react-native";

import * as ExpoDevice from "expo-device";

import { convertString } from "convert-string";

import base64 from "react-native-base64";
import {
    BleError,
    BleManager,
    Characteristic,
    Device,
  } from "react-native-ble-plx";

const DATA_SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
const RX_CHARACTERISTIC_UUID2 = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";
const TX_CHARACTERISTIC_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";
const RX_CHARACTERISTIC_UUID = "00002a00-0000-1000-8000-00805f9b34fb";

const bleManager = new BleManager();

function useBLE() {
  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [color, setColor] = useState("white");
  const [tfDistance, settfDistance] = useState<number | null>(null); // Add state for tfDistance


  const requestAndroid31Permissions = async () => {
    const bluetoothScanPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      {
        title: "Location Permission",
        message: "Bluetooth Low Energy requires Location",
        buttonPositive: "OK",
      }
    );
    const bluetoothConnectPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      {
        title: "Location Permission",
        message: "Bluetooth Low Energy requires Location",
        buttonPositive: "OK",
      }
    );
    const fineLocationPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: "Location Permission",
        message: "Bluetooth Low Energy requires Location",
        buttonPositive: "OK",
      }
    );

    return (
      bluetoothScanPermission === "granted" &&
      bluetoothConnectPermission === "granted" &&
      fineLocationPermission === "granted"
    );
  };

  const requestPermissions = async () => {
    if (Platform.OS === "android") {
      if ((ExpoDevice.platformApiLevel ?? -1) < 31) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Location Permission",
            message: "Bluetooth Low Energy requires Location",
            buttonPositive: "OK",
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const isAndroid31PermissionsGranted =
          await requestAndroid31Permissions();

        return isAndroid31PermissionsGranted;
      }
    } else {
      return true;
    }
  };

  const connectToDevice = async (device: Device) => {
    try {
      const deviceConnection = await bleManager.connectToDevice(device.id);
      setConnectedDevice(deviceConnection);
      await deviceConnection.discoverAllServicesAndCharacteristics();
      bleManager.stopDeviceScan();
      startStreamingData(deviceConnection);
      writeToDevice("1", deviceConnection);
 
    } catch (e) {
      console.log("FAILED TO CONNECT", e);
    }
  };

  const isDuplicteDevice = (devices: Device[], nextDevice: Device) =>
    devices.findIndex((device) => nextDevice.id === device.id) > -1;

  const scanForPeripherals = (): Promise<Device | null> => {
    return new Promise((resolve, reject) => {
      bleManager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.log(error);
          reject(error);
          return;
        }
  
        if (device && (device.localName === "BlueNRG" || device.name === "BlueNRG")) {
          setAllDevices((prevState: Device[]) => {
            if (!isDuplicteDevice(prevState, device)) {
              return [...prevState, device];
            }
            return prevState;
          });
          bleManager.stopDeviceScan();
          resolve(device);
        }
      });
  
      // Stop scanning after a timeout period
      setTimeout(() => {
        bleManager.stopDeviceScan();
        resolve(null);
      }, 10000); // 10 seconds timeout
    });
  };

  const onDataUpdate = (
        error: BleError | null,
        characteristic: Characteristic | null
        ) => {
        if (error) {
            console.log(error);
            return;
        } else if (!characteristic?.value) {
            console.log("No Data was received");
            return;
        }
        

        const decodedString = base64.decode( characteristic.value).trim();
       // console.log("Decoded String:", decodedString);
   
        // Convert the decoded string to an integer
        const tfDistance = parseInt(decodedString, 10);
      //  console.log("Color Code:", tfDistance);


        let color = "white";
        if (tfDistance === 1) {
            color = "blue";
        } else if (tfDistance === 2) {
            color = "red";
            console.log("red");
        } else if (tfDistance === 3) {
            color = "green";
        }
        settfDistance(tfDistance);
        setColor(color);

        if (tfDistance < 50) {
          Vibration.vibrate(400);
        }
    };

   const startStreamingData = async (device: Device) => {
        if (device) {
          device.monitorCharacteristicForService(
            DATA_SERVICE_UUID,
            TX_CHARACTERISTIC_UUID,
            onDataUpdate
          );
          try {
            device.discoverAllServicesAndCharacteristics();
            const services = await device.services();
            for (const service of services) {
              console.log(`Service UUID: ${service.uuid}`);
              const characteristics = await service.characteristics();
              for (const characteristic of characteristics) {
                console.log(`Characteristic UUID: ${characteristic.uuid}`);
                console.log(`Characteristic Properties: ${characteristic.value}`);
              }
            }

            // const characteristic = await device.readCharacteristicForService(
            //   DATA_SERVICE_UUID,
            //   TX_CHARACTERISTIC_UUID
            // );
            // console.log("Characteristic Value:", characteristic.value);
         
          } catch (error) {
            console.log("Failed to read value:", error);
          }

        } else {
          console.log("No Device Connected");
        }

        
    }

    

    const writeToDevice = async (message: string, device: Device) => {
      if (!device) {
        console.log("No device connected", connectedDevice);
        return;
      }

      const encodedMessage = base64.encode(message);
      
      try {
        await device.writeCharacteristicWithoutResponseForService(
          DATA_SERVICE_UUID,
          RX_CHARACTERISTIC_UUID2,
          encodedMessage
        );
        console.log("Message written:", message);
      } catch (error) {
        console.log("Failed to write message:", error);
      }
    };

    const disconnectFromDevice = async () => {
      if (!connectedDevice) {
        console.log("No device connected");
        return;
      }
    
      try {
        await bleManager.cancelDeviceConnection(connectedDevice.id);
        setConnectedDevice(null);
        console.log("Device disconnected");
      } catch (error) {
        console.log("Failed to disconnect device:", error);
        Vibration.vibrate(500);
      }
    };

  return {
    connectToDevice,
    allDevices,
    connectedDevice,
    color,
    tfDistance,
    requestPermissions,
    scanForPeripherals,
    startStreamingData,
    writeToDevice,
    disconnectFromDevice,
  };
}

export default useBLE;