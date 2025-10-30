/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
// In App.js in a new project

import { createStaticNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MenuScreen from "./Menu";
import NfcTestScreen from "./NfcTest";

export type RootStackParamList = {
  Menu: undefined;
  NfcTest: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>({
  screens: {
    Menu: MenuScreen,
    NfcTest: NfcTestScreen,
  },
});

const Navigation = createStaticNavigation(RootStack);

export default function App() {
  return <Navigation />;
}
