import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Shield, Copy } from "lucide-react";
import { useToast } from "../hooks/use-toast";

const CMDTab = () => {
  const { toast } = useToast();

  const commands = [
    { cmd: "SET_PSWD=[password];", desc: "Set the password (primary contact only)" },
    { cmd: "PSWD=[password],", desc: "Prefix before any command to get admin access" },
    { cmd: "LOCK=[0/1]", desc: "Lock or unlock the device (admin access)" },
    { cmd: "REBOOT", desc: "Reboot ESP32 (admin access)" },
    { cmd: "STATUS", desc: "Get current status and location (admin access)" },
    { cmd: "STATUS_TO=[NUMBER];", desc: "Send status to a specific number (admin access)" },
    { cmd: "CONTACTS?", desc: "Get contact list (admin access)" },
    { cmd: "CONTACT=[SLOT 1-5];[NAME];[NUMBER];", desc: "Add or update contacts (admin access)" },
    { cmd: "GPS_MODE=[0-9];", desc: "Set GPS mode (admin access)" },
    { cmd: "BOOT_MSG=[0/1];", desc: "Toggle boot status message (admin access)" },
    { cmd: "DS_CALLMODE=[0=auto decline, 1=silent, 2=vibrate, 3=sound];", desc: "Set deep sleep call mode (admin access)" },
    { cmd: "UPDATES=[DELAY M];", desc: "Send periodic updates (admin access)" },
    { cmd: "UPDATES_TO=[NUMBER];[DELAY M];", desc: "Send periodic updates to a number (admin access)" },
    { cmd: "CALL=[NUMBER];", desc: "Call a number (admin access)" },
    { cmd: "CALL=ME", desc: "Call the number the SMS came from (admin access)" },
    { cmd: "SCREAM", desc: "Turn on buzzer for 5 seconds (admin access)" },
    { cmd: "VIBRATE", desc: "Vibrate for 5 seconds (admin access)" },
    { cmd: "HELP", desc: "Get a list of all commands (admin access)" },
  ];

  const copyToClipboard = (cmd) => {
    navigator.clipboard.writeText(cmd);
    toast({
      title: "Copied!",
      description: `"${cmd}" has been copied to clipboard.`,
    });
  };

  return (
    <div className="p-6 pt-8 space-y-6">
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
                className="p-4 bg-gray-900 rounded-xl border border-gray-700 active:bg-gray-700 cursor-pointer transition group"
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
