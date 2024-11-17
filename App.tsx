import React, { useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Platform,
  Text,
  TouchableOpacity,
  View,
  Button,
  Vibration,
} from "react-native";

// import * as Haptics from 'expo-haptics';
import DeviceModal from "./DeviceConnectionModal";
import useBLE from "./useBLE";

const ONE_SECOND_IN_MS = 500;

const PATTERN = [
    0,
    ONE_SECOND_IN_MS,
    100,
    ONE_SECOND_IN_MS,
    100,
    ONE_SECOND_IN_MS,
    100,
    ONE_SECOND_IN_MS,
    100,
];

const PATTERN_DESC =
    Platform.OS === 'android'
      ? 'wait 1s, vibrate 2s, wait 3s'
      : 'wait 1s, vibrate, wait 2s, vibrate, wait 3s';

const App = () => {
  const {
    allDevices,
    connectedDevice,
    connectToDevice,
    color,
    requestPermissions,
    scanForPeripherals,
    writeToDevice,
    disconnectFromDevice,
  } = useBLE();
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);

  const scanForDevices = async () => {
    const isPermissionsEnabled = await requestPermissions();
    if (isPermissionsEnabled) {
      scanForPeripherals();
    }
  };

  const hideModal = () => {
    setIsModalVisible(false);
  };

  const openModal = async () => {
    scanForDevices();
    setIsModalVisible(true);
  };

  const handleSendValue = (value: string) => {
    writeToDevice(value);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color }]}>
      <View style={styles.heartRateTitleWrapper}>
        {connectedDevice ? (
          <>
            <Text style={styles.heartRateTitleText}>Connected</Text>
          </>
        ) : (
          <Text style={styles.heartRateTitleText}>
            Please connect the Arduino
          </Text>
        )}
      </View>
      <TouchableOpacity onPress={connectedDevice ? disconnectFromDevice : openModal} style={styles.ctaButton}>
        <Text style={styles.ctaButtonText}> {connectedDevice ? "Disconnect" : "Connect"}</Text>
      </TouchableOpacity>
      {connectedDevice && (
        <View style={styles.buttonContainer}>
          <Button title="Send 1" onPress={() => handleSendValue("1")} />
          <Button title="Send 2" onPress={() => handleSendValue("2")} />
          <Button title="Send 3" onPress={() => handleSendValue("3")} />
        </View>
      )}
      <View style={styles.hapticsContainer}>
        <Text style={styles.hapticsTitle}>Haptics</Text>
        <Button title="Selection" onPress={() => Vibration.vibrate()} />
        <Button
          title="Success"
          onPress={() => Vibration.vibrate(50)}
        />
        <Button
          title="Error"
          onPress={() => Vibration.vibrate(100)}
        />
        <Button
          title="Warning"
          onPress={() =>  Vibration.vibrate(200)}
        />
        <Button
          title="Light"
          onPress={() => Vibration.vibrate(300)}
        />
        <Button
          title="Medium"
          onPress={() => Vibration.vibrate(500)}
        />
        <Button
          title="Heavy"
          onPress={() => Vibration.vibrate(700)}
        />
        <Button
          title="Rigid"
          onPress={() => Vibration.vibrate(800)}
        />
        <Button
          title="Soft"
          onPress={() => Vibration.vibrate(PATTERN)}
        />
      </View>
      <DeviceModal
        closeModal={hideModal}
        visible={isModalVisible}
        connectToPeripheral={connectToDevice}
        devices={allDevices}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f2f2",
  },
  heartRateTitleWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  heartRateTitleText: {
    fontSize: 30,
    fontWeight: "bold",
    textAlign: "center",
    marginHorizontal: 20,
    color: "black",
  },
  heartRateText: {
    fontSize: 25,
    marginTop: 15,
  },
  ctaButton: {
    backgroundColor: "#FF6060",
    justifyContent: "center",
    alignItems: "center",
    height: 50,
    marginHorizontal: 20,
    marginBottom: 5,
    borderRadius: 8,
  },
  ctaButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 20,
  },
  hapticsContainer: {
    marginVertical: 20,
    paddingHorizontal: 20,
  },
  hapticsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
});

export default App;