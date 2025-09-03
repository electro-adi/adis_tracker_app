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
          title: "Command Sent",
          description: `IR command ${cmd} has been sent successfully.`,
        });
      } else {
        throw new Error('Failed to send command.');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send IR command.",
        variant: "destructive",
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">IR Commands</h1>
      </div>

      {/* Commands */}
      <div className="grid grid-cols-1 gap-6">
        <Card className="bg-gray-800 border border-gray-700 rounded-2xl shadow-md">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-lg font-semibold">
              <Shield className="w-5 h-5 text-gray-400" />
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
                  className="h-16 text-base font-medium 
                             bg-gray-700 hover:bg-gray-600 text-white 
                             rounded-xl shadow-sm transition-all"
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
