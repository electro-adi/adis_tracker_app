import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { BringToFront } from 'lucide-react';
import { useToast } from "../hooks/use-toast";
import { ref, set } from 'firebase/database';
import { db } from '../firebase';

const IRTab = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const SendIRCmd = async (cmd) => {
    setLoading(true);
    try {
      const commandRef = ref(db, 'Tracker/commands');
      await set(commandRef, {
        command: 'send_ir',
        data1: cmd,
        data2: ' ',
        timestamp: new Date().toISOString(),
        pending: true
      });

      toast({
        title: "Command Sent",
        description: `IR command ${cmd} has been sent successfully.`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send IR command.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const stored_commands = [
    { value: 0, name: 'Stored CMD (RED)' },
    { value: 1, name: 'Stored CMD (BLUE)' },
    { value: 2, name: 'Stored CMD (GREEN)' },
    { value: 3, name: 'Stored CMD (BLACK)' },
    { value: 4, name: 'Stored CMD (WHITE)' },
  ];

  return (
    <div className="px-[6vw] py-[5vh] space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">IR Commands</h1>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="bg-gray-800 border border-gray-700 rounded-2xl shadow-md">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-lg font-semibold">
              <BringToFront className="w-5 h-5 text-purple-400" />
              Stored IR Commands
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stored_commands.map((cmd) => {
                const textColor =
                  cmd.name.includes("RED") ? "text-red-500" :
                  cmd.name.includes("BLUE") ? "text-blue-500" :
                  cmd.name.includes("GREEN") ? "text-green-500" :
                  cmd.name.includes("BLACK") ? "text-gray-800" :
                  cmd.name.includes("WHITE") ? "text-gray-200" :
                  "text-white";

                return (
                  <div
                    key={cmd.value}
                    onClick={() => SendIRCmd(cmd.value)}
                    className="p-4 bg-gray-900 rounded-xl border border-gray-700 active:bg-gray-700"
                  >
                    <div className="flex justify-between items-center">
                      <div className={`${textColor} font-mono text-sm break-all`}>
                        {cmd.name}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default IRTab;