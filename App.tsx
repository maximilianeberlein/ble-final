import React, { useEffect, useState, useRef } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Vibration,
} from "react-native";
import MapboxGL from '@rnmapbox/maps';
import { OnPressEvent } from '@rnmapbox/maps';
import * as Location from 'expo-location';
import MapboxClient from '@mapbox/mapbox-sdk';
import Directions, { DirectionsResponse } from '@mapbox/mapbox-sdk/services/directions';
import Geocoding from '@mapbox/mapbox-sdk/services/geocoding';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import * as Haptics from 'expo-haptics';
import useBLE from "./useBLE";
import { point, lineString, nearestPointOnLine, distance } from '@turf/turf';
import { MAPBOX_ACCESS_TOKEN } from './token-keys'; // Import the token from config.js

MapboxGL.setAccessToken(MAPBOX_ACCESS_TOKEN);

const mapboxClient = MapboxClient({ accessToken: MAPBOX_ACCESS_TOKEN });
const directionsClient = Directions(mapboxClient);
const geocodingClient = Geocoding(mapboxClient);
const maxDistance = 20; // Maximum distance in kilometers

const App = () => {
  const {
    allDevices,
    connectedDevice,
    connectToDevice,
    color,
    tfDistance,
    requestPermissions,
    scanForPeripherals,
    writeToDevice,
    disconnectFromDevice,
  } = useBLE();
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [destination, setDestination] = useState<[number, number] | null>(null);
  const [route, setRoute] = useState<any>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [walkingTime, setWalkingTime] = useState<number | null>(null);
  // const cameraRef = useRef<MapboxGL.Camera>(null);

  useSpeechRecognitionEvent("start", () => {
    setIsListening(true);
    console.log("Speech recognition started");
  });
  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    console.log("Speech recognition ended");
    processTranscript(transcript);
  });
  useSpeechRecognitionEvent("result", (event) => {
    setTranscript(event.results[0]?.transcript);
    console.log("Speech recognition result:", event.results[0]?.transcript);
  });
  useSpeechRecognitionEvent("error", (event) => {
    console.log("error code:", event.error, "error message:", event.message);
    Vibration.vibrate(500); // Vibrate for 500 ms if an error occurs
  });

  const processTranscript = async (transcript: string) => {
    if (transcript) {
      console.log("Processing transcript:", transcript);
      // Use the Geocoding API to convert the voice input to coordinates
      try {
        const response = await geocodingClient.forwardGeocode({
          query: transcript,
          limit: 1,
        }).send();

        if (response.body.features.length > 0) {
          const [longitude, latitude] = response.body.features[0].center;
          const distanceToDestination = distance(
            point([currentLocation?.coords.longitude ?? 0, currentLocation?.coords.latitude ?? 0]),
            point([longitude, latitude]),
            { units: 'kilometers' }
          );

          if (distanceToDestination <= maxDistance) {
            setDestination([longitude, latitude]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
          } else {
            console.log("Destination is too far.");
            Vibration.vibrate([0, 200, 200, 200, 200, 200]); // Pattern: wait 0ms, vibrate 200ms, wait 200ms, vibrate 200ms, wait 200ms, vibrate 200ms
          }
        } else {
          console.log("No results found for the given address.");
          Vibration.vibrate([0, 200, 200, 200, 200, 200]); // Pattern: wait 0ms, vibrate 200ms, wait 200ms, vibrate 200ms, wait 200ms, vibrate 200ms
        }
      } catch (error) {
        console.error("Error fetching coordinates:", error);
        Vibration.vibrate([0, 200, 200, 200, 200, 200]); // Pattern: wait 0ms, vibrate 200ms, wait 200ms, vibrate 200ms, wait 200ms, vibrate 200ms
      }
    }
  };

  useEffect(() => {
    if (!connectedDevice) return;

    let locationSubscription: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission to access location was denied');
        return;
      }

      const initialLocation = await Location.getCurrentPositionAsync({});
      setCurrentLocation(initialLocation);

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000, // Update every second
          distanceInterval: 1, // Update every meter
        },
        (newLocation) => {
          setCurrentLocation(newLocation);
          // cameraRef.current?.setCamera({
          //   centerCoordinate: [newLocation.coords.longitude, newLocation.coords.latitude],
          //   zoomLevel: 14,
          //   animationDuration: 0,
          // });
        }
      );
    })();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [connectedDevice]);

  const calculateDirections = async () => {
    if (currentLocation && destination) {
      const response: DirectionsResponse = await directionsClient.getDirections({
        profile: 'walking',
        waypoints: [
          {
            coordinates: [currentLocation.coords.longitude, currentLocation.coords.latitude],
          },
          {
            coordinates: destination,
          },
        ],
        geometries: 'geojson',
        steps: true, // Include steps for turn-by-turn instructions
      }).send();

      if (response.body && response.body.routes.length > 0) {
        setRoute(response.body.routes[0].geometry);
        setWalkingTime(response.body.routes[0].duration); // Set the walking time in seconds
        // setInstructions(response.body.routes[0].legs[0].steps); // Commented out to hide instructions
        console.log("Route set:", response.body.routes[0].geometry);
      }
    }
  };

  const calculateNearestPointDistance = (location: Location.LocationObject, route: any) => {
    const locationPoint = point([location.coords.longitude, location.coords.latitude]);
    const line = lineString(route.coordinates);
    const nearestPoint = nearestPointOnLine(line, locationPoint);
    const distanceToNearestPoint = distance(locationPoint, nearestPoint, { units: 'meters' });
    return distanceToNearestPoint; // Distance in meters
  };

  useEffect(() => {
    if (!connectedDevice) return;

    if (currentLocation && route) {
      const distance = calculateNearestPointDistance(currentLocation, route);
      console.log("Distance to route:", distance);
      if (distance > 30) {
        console.log("Vibrating");
        Vibration.vibrate(500); // Vibrate for 500 ms if distance is greater than 20 meters
      }
      if (distance > 35) {
        console.log("Calculating new route");
        calculateDirections();
      }
    }
  }, [currentLocation, route, connectedDevice]);

  useEffect(() => {
    if (!connectedDevice) return;

    if (destination) {
      calculateDirections();
    }
  }, [destination, connectedDevice]);

  const handleMapPress = async (event: OnPressEvent) => {
    const { geometry } = event;
    const newDestination = geometry.coordinates;
    if (currentLocation) {
      const distanceToDestination = distance(
        point([currentLocation?.coords.longitude ?? 0, currentLocation?.coords.latitude ?? 0]),
        point(newDestination),
        { units: 'kilometers' }
      );

      if (distanceToDestination <= maxDistance) {
        setDestination(newDestination);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        console.log("Destination is too far.");
        Vibration.vibrate([0, 200, 200, 200, 200, 200]); // Pattern: wait 0ms, vibrate 200ms, wait 200ms, vibrate 200ms, wait 200ms, vibrate 200ms
      }
   }
  };

  const scanForDevices = async () => {
    try {
      const isPermissionsEnabled = await requestPermissions();
      if (isPermissionsEnabled) {
        const device = await scanForPeripherals();
        if (device) {
          try {
            await connectToDevice(device);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            handleSendValue("1");
          } catch (error) {
            console.error("Error connecting to device:", error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
        } else {
          console.log("No BlueNRG device found");
          Vibration.vibrate(500); // Vibrate for 500 ms if no device is found
        }
      }
    } catch (error) {
      console.error("Error scanning for devices:", error);
    }
  };

  const handleSendValue = (value: string) => {
    console.log("Sending value:", value);
    writeToDevice(value);
  };

  const handleStartListening = async () => {
    setTranscript(""); // Clear the transcript before starting a new session
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) {
      console.warn("Permissions not granted", result);
      return;
    }
    // Start speech recognition
    ExpoSpeechRecognitionModule.start({
      lang: "de-DE",
      interimResults: true,
      maxAlternatives: 1,
      continuous: false,
      requiresOnDeviceRecognition: false,
      addsPunctuation: false,
      //contextualStrings: ["Carlsen", "Nepomniachtchi", "Praggnanandhaa"],
    });
  };

  const handleDisconnect = async () => {
    try {
      await disconnectFromDevice();
      setCurrentLocation(null);
      setDestination(null);
      setRoute(null);
      setWalkingTime(null);
      // setInstructions([]); // Commented out to hide instructions
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error disconnecting from device:", error);
      Vibration.vibrate(500); // Pattern: wait 0ms, vibrate 200ms, wait 200ms, vibrate 200ms, wait 200ms, vibrate 200ms
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: "#000000" }]}>
      {!connectedDevice ? (
        <TouchableOpacity onPress={scanForDevices} style={styles.fullScreenButton}>
          <Text style={styles.fullScreenButtonText}>Connect To HAPPI</Text>
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity onPress={handleDisconnect} style={styles.ctaButton}>
            <Text style={styles.ctaButtonText}>Disconnect</Text>
          </TouchableOpacity>
          {tfDistance !== null && (
            <View style={styles.tfDistanceContainer}>
              <Text style={styles.tfDistanceText}>Sensor Distance: {tfDistance/100.0} m</Text>
            </View>
          )}
          {walkingTime !== null && (
            <View style={styles.walkingTimeContainer}>
              <Text style={styles.walkingTimeText}>Estimated Walking Time: {Math.round(walkingTime / 60)} min</Text>
            </View>
          )}
          <View style={styles.mapContainer}>
          {currentLocation && (
            <View style={styles.mapWrapper}>
              <MapboxGL.MapView style={styles.map} onPress={handleMapPress}>
                <MapboxGL.Camera
                  zoomLevel={14}
                  centerCoordinate={[8.5422, 47.3725]
                    // currentLocation
                    //   ? [currentLocation.coords.longitude, currentLocation.coords.latitude]
                    //   : [8.5422, 47.3725] // Default coordinates
                  }
                />
                {route && (
                  <MapboxGL.ShapeSource id="routeSource" shape={route}>
                    <MapboxGL.LineLayer id="routeLayer" style={styles.routeLine} />
                  </MapboxGL.ShapeSource>
                )}
                <MapboxGL.PointAnnotation
                  id="currentLocation"
                  coordinate={[currentLocation.coords.longitude, currentLocation.coords.latitude]}
                >
                  <View style={styles.annotationContainer}>
                    <View style={styles.annotationFill} />
                  </View>
                </MapboxGL.PointAnnotation>
                {destination && (
                  <MapboxGL.PointAnnotation
                    id="destination"
                    coordinate={destination}
                  >
                    <View style={styles.annotationContainer}>
                      <View style={styles.destinationFill} /> {/* Updated style for destination */}
                    </View>
                  </MapboxGL.PointAnnotation>
                )}
                <MapboxGL.UserLocation visible={true} />
              </MapboxGL.MapView>
            </View>
          )}
        </View>
          {/* <ScrollView style={styles.instructionsContainer}>
            {instructions.map((step, index) => (
              <Text key={index} style={styles.instructionText}>
                {step.maneuver.instruction}
              </Text>
            ))}
          </ScrollView>
           */}
          <TouchableOpacity
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              handleStartListening();
            }}
            style={styles.voiceButton}
          >
            <Text style={styles.voiceButtonText}>{isListening ? "Listening..." : "Where To Go?"}</Text>
          </TouchableOpacity>
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  fullScreenButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#383838",
  },
  fullScreenButtonText: {
    fontSize: 50,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
  },
  ctaButton: {
    backgroundColor: "#383838",
    justifyContent: "center",
    alignItems: "center",
    height: '20%', // One fourth of the screen height
    marginHorizontal: 20,
    marginBottom: 5,
    marginTop: 5,
    borderRadius: 15,
  },
  ctaButtonText: {
    fontSize: 30,
    fontWeight: "bold",
    color: "white",
  },
  tfDistanceContainer: {
    alignItems: "center",
    marginVertical: 5,
  },
  tfDistanceText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#8a8a8a",
  },
  walkingTimeContainer: {
    alignItems: "center",
    marginVertical: 5,
  },
  walkingTimeText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#8a8a8a",
  },
  mapContainer: {
    flex: 1,
    marginVertical: 5,
    marginHorizontal: 20,
  },
  mapWrapper: {
    flex: 1,
    borderRadius: 15,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  annotationContainer: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'red',
    borderRadius: 15,
  },
  annotationFill: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: '#003a88',
    transform: [{ scale: 0.6 }],
  },
  destinationFill: { // New style for destination point
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: '#003a88', // Change this color to your desired color
    transform: [{ scale: 0.6 }],
  },
  routeLine: {
    lineColor: '#003a88',	
    lineWidth: 4,
  },
  voiceButton: {
    backgroundColor: "#383838",
    justifyContent: "center",
    alignItems: "center",
    height: '20%', // One fourth of the screen height
    marginHorizontal: 20,
    marginBottom: 5,
    marginTop: 10,
    borderRadius: 15,
  },
  voiceButtonText: {
    fontSize: 30,
    fontWeight: "bold",
    color: "white",
  },
});

export default App;