import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Shield } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const IRTab = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const SendIRCmd = async (cmd) => {
    setLoading(true);
    try {
      const response = await fetch(`${API}/device/irsend/${cmd}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        toast({
          title: "✅ Command Sent",
          description: `IR command ${cmd} has been sent successfully.`,
        });
      } else {
        throw new Error('Failed to send command.');
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Failed to send IR command.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const stored_commands = [
    { value: 0, name: 'Stored CMD (RED)', color: 'from-red-500 to-pink-500' },
    { value: 1, name: 'Stored CMD (BLUE)', color: 'from-blue-500 to-cyan-500' },
    { value: 2, name: 'Stored CMD (GREEN)', color: 'from-green-500 to-emerald-500' },
    { value: 3, name: 'Stored CMD (BLACK)', color: 'from-gray-700 to-gray-900' },
    { value: 4, name: 'Stored CMD (WHITE)', color: 'from-slate-300 to-white text-gray-900' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-extrabold text-white tracking-wide drop-shadow-lg">
          🔴 IR Command Center
        </h1>
      </div>

      {/* Commands */}
      <div className="grid grid-cols-1 gap-6">
        <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-xl font-semibold">
              <Shield className="w-6 h-6 text-red-400 animate-pulse" />
              Stored IR Commands
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stored_commands.map((cmd) => (
                <Button
                  key={cmd.value}
                  onClick={() => SendIRCmd(cmd.value)}
                  disabled={loading}
                  className={`h-20 text-lg font-bold rounded-2xl shadow-lg 
                             bg-gradient-to-r ${cmd.color} 
                             hover:scale-105 active:scale-95 
                             transition-all duration-200 ease-in-out 
                             hover:shadow-[0_0_15px_rgba(255,255,255,0.3)]`}
                >
                  {cmd.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default IRTab;
