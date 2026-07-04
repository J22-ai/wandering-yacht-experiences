import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

interface TransferLocation {
  address: string;
  lat: number | null;
  lng: number | null;
}

interface TransferBookingFieldsProps {
  pickupLocation: TransferLocation;
  dropoffLocation: TransferLocation;
  pickupTime: string;
  dropoffTime: string;
  onPickupLocationChange: (loc: TransferLocation) => void;
  onDropoffLocationChange: (loc: TransferLocation) => void;
  onPickupTimeChange: (time: string) => void;
  onDropoffTimeChange: (time: string) => void;
}

const MAP_HTML = (lat: number, lng: number, label: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body { margin: 0; padding: 0; }
    #map { width: 100%; height: 100vh; }
    .pin-instruction {
      position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
      background: rgba(26,58,74,0.9); color: #fff; padding: 8px 16px;
      border-radius: 20px; font-size: 13px; z-index: 1000; white-space: nowrap;
      font-family: -apple-system, sans-serif;
    }
    .confirm-btn {
      position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
      background: #c17f59; color: #fff; padding: 12px 32px;
      border-radius: 8px; font-size: 15px; z-index: 1000; border: none;
      cursor: pointer; font-weight: 600; font-family: -apple-system, sans-serif;
      display: none;
    }
  </style>
</head>
<body>
  <div class="pin-instruction">Tap to drop a pin for ${label}</div>
  <button class="confirm-btn" id="confirmBtn" onclick="confirmLocation()">Confirm Location</button>
  <div id="map"></div>
  <script>
    var map = L.map('map').setView([${lat}, ${lng}], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map);
    
    var marker = null;
    var selectedLat = null;
    var selectedLng = null;
    
    map.on('click', function(e) {
      selectedLat = e.latlng.lat;
      selectedLng = e.latlng.lng;
      if (marker) { map.removeLayer(marker); }
      marker = L.marker([selectedLat, selectedLng]).addTo(map);
      document.getElementById('confirmBtn').style.display = 'block';
    });
    
    function confirmLocation() {
      if (selectedLat && selectedLng) {
        var msg = JSON.stringify({ lat: selectedLat, lng: selectedLng });
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(msg);
        } else {
          window.parent.postMessage(msg, '*');
        }
      }
    }
  </script>
</body>
</html>
`;

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

function TimePicker({ visible, onClose, onSelect, currentValue }: {
  visible: boolean;
  onClose: () => void;
  onSelect: (time: string) => void;
  currentValue: string;
}) {
  const [selectedHour, setSelectedHour] = useState(currentValue ? currentValue.split(':')[0] : '09');
  const [selectedMinute, setSelectedMinute] = useState(currentValue ? currentValue.split(':')[1] : '00');

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={timeStyles.overlay}>
        <View style={timeStyles.container}>
          <Text style={timeStyles.title}>Select Time</Text>
          <View style={timeStyles.pickerRow}>
            <ScrollView style={timeStyles.column} showsVerticalScrollIndicator={false}>
              {HOURS.map(h => (
                <TouchableOpacity
                  key={h}
                  style={[timeStyles.item, selectedHour === h && timeStyles.itemSelected]}
                  onPress={() => setSelectedHour(h)}
                >
                  <Text style={[timeStyles.itemText, selectedHour === h && timeStyles.itemTextSelected]}>{h}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={timeStyles.separator}>:</Text>
            <ScrollView style={timeStyles.column} showsVerticalScrollIndicator={false}>
              {MINUTES.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[timeStyles.item, selectedMinute === m && timeStyles.itemSelected]}
                  onPress={() => setSelectedMinute(m)}
                >
                  <Text style={[timeStyles.itemText, selectedMinute === m && timeStyles.itemTextSelected]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <View style={timeStyles.buttonRow}>
            <TouchableOpacity onPress={onClose} style={timeStyles.cancelBtn}>
              <Text style={timeStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { onSelect(`${selectedHour}:${selectedMinute}`); onClose(); }}
              style={timeStyles.confirmBtn}
            >
              <Text style={timeStyles.confirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function TransferBookingFields({
  pickupLocation,
  dropoffLocation,
  pickupTime,
  dropoffTime,
  onPickupLocationChange,
  onDropoffLocationChange,
  onPickupTimeChange,
  onDropoffTimeChange,
}: TransferBookingFieldsProps) {
  const [showPickupMap, setShowPickupMap] = useState(false);
  const [showDropoffMap, setShowDropoffMap] = useState(false);
  const [showPickupTime, setShowPickupTime] = useState(false);
  const [showDropoffTime, setShowDropoffTime] = useState(false);

  // Default center: Tivat, Montenegro
  const defaultLat = 42.4348;
  const defaultLng = 18.6960;

  const handleMapMessage = (event: any, type: 'pickup' | 'dropoff') => {
    try {
      const data = JSON.parse(event.nativeEvent?.data || event.data);
      if (data.lat && data.lng) {
        const loc = {
          address: type === 'pickup' ? pickupLocation.address : dropoffLocation.address,
          lat: data.lat,
          lng: data.lng,
        };
        if (type === 'pickup') {
          onPickupLocationChange(loc);
          setShowPickupMap(false);
        } else {
          onDropoffLocationChange(loc);
          setShowDropoffMap(false);
        }
      }
    } catch (e) {}
  };

  const renderMapModal = (visible: boolean, onClose: () => void, type: 'pickup' | 'dropoff') => (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.mapModalContainer}>
        <View style={styles.mapHeader}>
          <TouchableOpacity onPress={onClose} style={styles.mapCloseBtn}>
            <Ionicons name="close" size={24} color="#1a2a30" />
          </TouchableOpacity>
          <Text style={styles.mapHeaderTitle}>{type === 'pickup' ? 'Pickup Location' : 'Dropoff Location'}</Text>
          <View style={{ width: 40 }} />
        </View>
        {Platform.OS === 'web' ? (
          <iframe
            srcDoc={MAP_HTML(defaultLat, defaultLng, type === 'pickup' ? 'Pickup' : 'Dropoff')}
            style={{ flex: 1, width: '100%', height: '100%', border: 'none' } as any}
            onLoad={(e: any) => {
              window.addEventListener('message', (msg) => {
                try {
                  const data = JSON.parse(msg.data);
                  if (data.lat && data.lng) {
                    const loc = {
                      address: type === 'pickup' ? pickupLocation.address : dropoffLocation.address,
                      lat: data.lat,
                      lng: data.lng,
                    };
                    if (type === 'pickup') {
                      onPickupLocationChange(loc);
                      setShowPickupMap(false);
                    } else {
                      onDropoffLocationChange(loc);
                      setShowDropoffMap(false);
                    }
                  }
                } catch {}
              });
            }}
          />
        ) : (
          <WebView
            source={{ html: MAP_HTML(defaultLat, defaultLng, type === 'pickup' ? 'Pickup' : 'Dropoff') }}
            style={{ flex: 1 }}
            onMessage={(event) => handleMapMessage(event, type)}
            javaScriptEnabled
          />
        )}
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>TRANSFER DETAILS</Text>

      {/* Pickup Location */}
      <View style={styles.fieldGroup}>
        <View style={styles.fieldHeader}>
          <Ionicons name="location" size={18} color="#c17f59" />
          <Text style={styles.fieldLabel}>Pickup Location *</Text>
        </View>
        <TextInput
          style={styles.textInput}
          placeholder="Enter pickup address..."
          placeholderTextColor="#9ca3a3"
          value={pickupLocation.address}
          onChangeText={(text) => onPickupLocationChange({ ...pickupLocation, address: text })}
        />
        <TouchableOpacity style={styles.mapButton} onPress={() => setShowPickupMap(true)}>
          <Ionicons name="map-outline" size={16} color="#fff" />
          <Text style={styles.mapButtonText}>
            {pickupLocation.lat ? 'Pin Placed ✓ — Change on Map' : 'Drop Pin on Map'}
          </Text>
        </TouchableOpacity>
        {pickupLocation.lat && (
          <Text style={styles.coordText}>
            📍 {pickupLocation.lat.toFixed(4)}, {pickupLocation.lng?.toFixed(4)}
          </Text>
        )}
      </View>

      {/* Dropoff Location */}
      <View style={styles.fieldGroup}>
        <View style={styles.fieldHeader}>
          <Ionicons name="flag" size={18} color="#c17f59" />
          <Text style={styles.fieldLabel}>Dropoff Location *</Text>
        </View>
        <TextInput
          style={styles.textInput}
          placeholder="Enter dropoff address..."
          placeholderTextColor="#9ca3a3"
          value={dropoffLocation.address}
          onChangeText={(text) => onDropoffLocationChange({ ...dropoffLocation, address: text })}
        />
        <TouchableOpacity style={styles.mapButton} onPress={() => setShowDropoffMap(true)}>
          <Ionicons name="map-outline" size={16} color="#fff" />
          <Text style={styles.mapButtonText}>
            {dropoffLocation.lat ? 'Pin Placed ✓ — Change on Map' : 'Drop Pin on Map'}
          </Text>
        </TouchableOpacity>
        {dropoffLocation.lat && (
          <Text style={styles.coordText}>
            📍 {dropoffLocation.lat.toFixed(4)}, {dropoffLocation.lng?.toFixed(4)}
          </Text>
        )}
      </View>

      {/* Pickup Time */}
      <View style={styles.fieldGroup}>
        <View style={styles.fieldHeader}>
          <Ionicons name="time-outline" size={18} color="#c17f59" />
          <Text style={styles.fieldLabel}>Pickup Time *</Text>
        </View>
        <TouchableOpacity style={styles.timeButton} onPress={() => setShowPickupTime(true)}>
          <Text style={[styles.timeButtonText, !pickupTime && styles.timePlaceholder]}>
            {pickupTime || 'Select pickup time'}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#1a3a4a" />
        </TouchableOpacity>
      </View>

      {/* Dropoff Time */}
      <View style={styles.fieldGroup}>
        <View style={styles.fieldHeader}>
          <Ionicons name="time-outline" size={18} color="#c17f59" />
          <Text style={styles.fieldLabel}>Return / Dropoff Time *</Text>
        </View>
        <TouchableOpacity style={styles.timeButton} onPress={() => setShowDropoffTime(true)}>
          <Text style={[styles.timeButtonText, !dropoffTime && styles.timePlaceholder]}>
            {dropoffTime || 'Select return time'}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#1a3a4a" />
        </TouchableOpacity>
      </View>

      {/* Map Modals */}
      {renderMapModal(showPickupMap, () => setShowPickupMap(false), 'pickup')}
      {renderMapModal(showDropoffMap, () => setShowDropoffMap(false), 'dropoff')}

      {/* Time Picker Modals */}
      <TimePicker
        visible={showPickupTime}
        onClose={() => setShowPickupTime(false)}
        onSelect={onPickupTimeChange}
        currentValue={pickupTime}
      />
      <TimePicker
        visible={showDropoffTime}
        onClose={() => setShowDropoffTime(false)}
        onSelect={onDropoffTimeChange}
        currentValue={dropoffTime}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 16,
  },
  sectionLabel: {
    fontFamily: 'TraditionalArabic',
    fontSize: 14,
    color: '#c17f59',
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 16,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontFamily: 'TraditionalArabic',
    fontSize: 15,
    color: '#1a3a4a',
    fontWeight: '600',
    marginLeft: 8,
  },
  textInput: {
    fontFamily: 'TraditionalArabic',
    fontSize: 15,
    color: '#1a2a30',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0ddd7',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a3a4a',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  mapButtonText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  coordText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 12,
    color: '#9ca3a3',
    marginTop: 4,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0ddd7',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  timeButtonText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 16,
    color: '#1a2a30',
    fontWeight: '600',
  },
  timePlaceholder: {
    color: '#9ca3a3',
    fontWeight: '400',
  },
  mapModalContainer: {
    flex: 1,
    backgroundColor: '#f5f2ed',
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 50,
    backgroundColor: '#f5f2ed',
    borderBottomWidth: 1,
    borderBottomColor: '#e0ddd7',
  },
  mapCloseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapHeaderTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 18,
    fontWeight: '600',
    color: '#1a2a30',
  },
});

const timeStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#f5f2ed',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontFamily: 'TraditionalArabic',
    fontSize: 20,
    fontWeight: '700',
    color: '#1a2a30',
    textAlign: 'center',
    marginBottom: 20,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
  },
  column: {
    width: 80,
    maxHeight: 200,
  },
  separator: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a3a4a',
    marginHorizontal: 12,
  },
  item: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  itemSelected: {
    backgroundColor: '#1a3a4a',
  },
  itemText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 20,
    color: '#4a5568',
  },
  itemTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0ddd7',
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 16,
    color: '#4a5568',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#c17f59',
    alignItems: 'center',
  },
  confirmText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
  },
});
