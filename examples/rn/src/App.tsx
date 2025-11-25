/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
// In App.js in a new project

import { createStaticNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MenuScreen from "./screens/MenuScreen";
import SmartCardTestScreen from "./screens/SmartCardTestScreen";
import NfcAntennaScreen from "./screens/NfcAntennaScreen";
import NfcAntennaDetailScreen from "./screens/NfcAntennaDetailScreen";
import MynaPinScreen from "./screens/MynaPinScreen";
import MynaReadScreen from "./screens/MynaReadScreen";
import MynaShowScreen from "./screens/MynaShowScreen";
import "@bacons/text-decoder/install";
import type { BasicFourInfo } from "./types/myna";

export type RootStackParamList = {
  Menu: undefined;
  NfcAntenna: undefined;
  NfcAntennaDetail: undefined;
  // New multi-device test route
  SmartCardTest: undefined;
  MynaPin: undefined;
  MynaRead: { pin: string };
  MynaShow: { info?: BasicFourInfo; raw?: number[] };
};

const RootStack = createNativeStackNavigator<RootStackParamList>({
  screens: {
    Menu: MenuScreen,
    NfcAntenna: NfcAntennaScreen,
    NfcAntennaDetail: {
      screen: NfcAntennaDetailScreen,
      options: {
        headerShown: false,
      },
    },
    SmartCardTest: SmartCardTestScreen,
    MynaPin: MynaPinScreen,
    MynaRead: MynaReadScreen,
    MynaShow: MynaShowScreen,
  },
});

const Navigation = createStaticNavigation(RootStack);

export default function App() {
  return <Navigation />;
}
