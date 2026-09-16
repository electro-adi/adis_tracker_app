import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Shield, Copy } from "lucide-react";
import { useToast } from "../hooks/use-toast";

const CMDTab = () => {
  const { toast } = useToast();

const commands = [
  { cmd: "SET_PSWD=[password];", desc: "Set the password (primary contact only)" },
  { cmd: "PSWD=[password],", desc: "Prefix before a command to gain admin access" },
  { cmd: "LOCK=[0/1];", desc: "Lock or unlock the device (admin access)" },
  { cmd: "REBOOT", desc: "Reboot ESP32 (admin access)" },
  { cmd: "STATUS", desc: "Get current device status (admin access)" },
  { cmd: "STATUS_TO=[NUMBER];", desc: "Send status to a specific number (admin access)" },
  { cmd: "LOCATION", desc: "Get current GPS and LBS location (admin access)" },
  { cmd: "LOCATION_TO=[NUMBER];", desc: "Send GPS and LBS location to a specific number (admin access)" },
  { cmd: "CONTACTS?", desc: "Get the contact list (admin access)" },
  { cmd: "CONTACT=[SLOT 1-5];[NAME];[NUMBER];", desc: "Add or update a contact (admin access)" },
  { cmd: "MQTT=[0/1];", desc: "Enable or disable MQTT (admin access)" },
  { cmd: "GPS_MODE=[0-9];", desc: "Set GPS mode (admin access)" },
  { cmd: "BOOT_MSG=[0/1];", desc: "Enable or disable boot status messages (admin access)" },
  { cmd: "DS_CALLMODE=[0-3];", desc: "Set deep sleep call mode: 0=decline, 1=silent, 2=vibrate, 3=sound (admin access)" },
  { cmd: "PRD_UPDATES=[DELAY M];", desc: "Send periodic status and location updates (admin access)" },
  { cmd: "PRD_UPDATES_TO=[NUMBER];[DELAY M];", desc: "Send periodic updates to a specific number (admin access)" },
  { cmd: "EPS_MODE=[0/1];", desc: "Enable or disable extreme power saving mode (admin access)" },
  { cmd: "CALL=[NUMBER];", desc: "Call a specified number (admin access)" },
  { cmd: "CALL=ME", desc: "Call the number the SMS was received from (admin access)" },
  { cmd: "SCREAM", desc: "Turn on the buzzer for 5 seconds (admin access)" },
  { cmd: "VIBRATE", desc: "Activate vibration for 5 seconds (admin access)" },
  { cmd: "HELP", desc: "Get a list of all available commands (admin access)" },
];

  const copyToClipboard = (cmd) => {
    navigator.clipboard.writeText(cmd);
    toast({
      title: "Copied!",
      description: `"${cmd}" has been copied to clipboard.`
    });
  };

  return (
    <div className="px-[6vw] py-[5vh] space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">SMS Commands</h1>
      </div>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Shield className="w-5 h-5 mr-2 text-blue-400" />
            Available Commands
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {commands.map((c, i) => (
              <div
                key={i}
                onClick={() => copyToClipboard(c.cmd)}
                className="p-4 bg-gray-900 rounded-xl border border-gray-700 active:bg-gray-700"
              >
                <div className="flex justify-between items-center">
                  <code className="text-green-400 font-mono text-sm break-all">
                    {c.cmd}
                  </code>
                  <Copy className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-xs text-gray-400 mt-2">{c.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CMDTab;
