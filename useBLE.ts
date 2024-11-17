/* eslint-disable no-bitwise */
import { useMemo, useState } from "react";
import { PermissionsAndroid, Platform } from "react-native";

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
  const [characteristicUUID, setCharacteristicUUID] = useState<string | null>(null);
  const [serviceUUID, setServiceUUID] = useState<string | null>(null);

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

  const getServicesAndCharacteristics = async (device: Device) => {
    const services = await device.services();
    for (const service of services) {
      const characteristics = await service.characteristics();
      for (const characteristic of characteristics) {
        if (characteristic.isWritableWithoutResponse || characteristic.isWritableWithResponse) {
          setServiceUUID(service.uuid);
          setCharacteristicUUID(characteristic.uuid);
          return characteristic;
        }
      }
    }
    throw new Error("No writable characteristic found");
  };


  const connectToDevice = async (device: Device) => {
    try {
      const deviceConnection = await bleManager.connectToDevice(device.id);
      setConnectedDevice(deviceConnection);
      await deviceConnection.discoverAllServicesAndCharacteristics();
      bleManager.stopDeviceScan();
      const characteristic = await getServicesAndCharacteristics(deviceConnection);
      startStreamingData(deviceConnection);
      console.log(`Connected to device with characteristic UUID: ${characteristic.uuid}`);
    } catch (e) {
      console.log("FAILED TO CONNECT", e);
    }
  };

  const isDuplicteDevice = (devices: Device[], nextDevice: Device) =>
    devices.findIndex((device) => nextDevice.id === device.id) > -1;

  const scanForPeripherals = () =>
    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.log(error);
      }

      if (
        device &&
        (device.localName === "BlueNRG" || device.name === "BLueNRG")
      ) {
        setAllDevices((prevState: Device[]) => {
          if (!isDuplicteDevice(prevState, device)) {
            return [...prevState, device];
          }
          return prevState;
        });
      }
    });

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

        // Remove the last two elements from characteristic.value
        const trimmedValue = characteristic.value.slice(0, -2);
        console.log("Data received", trimmedValue);

        const decodedString = base64.decode(trimmedValue).trim();
        console.log("Decoded String:", decodedString);
        console.log("Type of Decoded String:", typeof decodedString);
        console.log("Length of Decoded String:", decodedString.length);

        // Convert the decoded string to an integer
        const colorCode = parseInt(decodedString, 10);
        console.log("Color Code:", colorCode);
        console.log("Color Code Comparison:", colorCode === 1);


        let color = "white";
        if (colorCode === 1) {
            color = "blue";
        } else if (colorCode === 2) {
            color = "red";
            console.log("red");
        } else if (colorCode === 3) {
            color = "green";
        }

        setColor(color);
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

    

    const writeToDevice = async (message: string) => {
      if (!connectedDevice) {
        console.log("No device connected");
        return;
      }

      const encodedMessage = base64.encode(message);
      
      try {
        await connectedDevice.writeCharacteristicWithoutResponseForService(
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
      }
    };

  return {
    connectToDevice,
    allDevices,
    connectedDevice,
    color,
    requestPermissions,
    scanForPeripherals,
    startStreamingData,
    writeToDevice,
    disconnectFromDevice,
  };
}

export default useBLE;