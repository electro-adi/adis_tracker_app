import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Radio, Send, Terminal } from 'lucide-react';
import { useToast } from "../hooks/use-toast";
import { ref, set, push, onValue, update } from 'firebase/database';
import { db } from '../firebase';

const EspNowTab = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [currentMode, setCurrentMode] = useState(0);
  const [bootMode, setBootMode] = useState(0);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getTimeAgo = (isoString) => {
    if (!isoString) return '';
    const now = new Date();
    const past = new Date(isoString);
    const diffMs = now - past;
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) return `${diffSec}s`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d`;
  };

  useEffect(() => {
    const statusRef = ref(db, 'Tracker/status/latest');
    const unsubStatus = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.espnow_state !== undefined) {
        setCurrentMode(data.espnow_state);
      }
    });

    const configRef = ref(db, 'Tracker/deviceconfig');
    const unsubConfig = onValue(configRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.espnow_boot_m !== undefined) {
        setBootMode(data.espnow_boot_m);
      }
    });

    const receivedRef = ref(db, 'Tracker/espnow/received');
    const sentRef = ref(db, 'Tracker/espnow/sent');

    const updateMessages = () => {
      onValue(receivedRef, (receivedSnapshot) => {
        const receivedData = receivedSnapshot.val();
        const receivedMsgs = receivedData ? Object.values(receivedData).map(item => ({
          ...item,
          type: 'received'
        })) : [];

        onValue(sentRef, (sentSnapshot) => {
          const sentData = sentSnapshot.val();
          const sentMsgs = sentData ? Object.values(sentData).map(item => ({
            ...item,
            type: 'sent'
          })) : [];

          const allMessages = [...receivedMsgs, ...sentMsgs].sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
          );

          setMessages(allMessages);
        }, { onlyOnce: true });
      }, { onlyOnce: true });
    };

    const unsubReceived = onValue(receivedRef, updateMessages);
    const unsubSent = onValue(sentRef, updateMessages);

    return () => {
      unsubStatus();
      unsubConfig();
      unsubReceived();
      unsubSent();
    };
  }, []);

  const SendEspnowCmd = async (cmd) => {
    if (!cmd.trim()) {
      toast({
        title: "Error",
        description: "Command cannot be empty",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const sentRef = ref(db, 'Tracker/espnow/sent');
      await push(sentRef, {
        msg: cmd,
        timestamp: new Date().toISOString(),
      });

      const commandRef = ref(db, 'Tracker/commands');
      await set(commandRef, {
        command: 'send_espnow',
        data1: cmd,
        data2: ' ',
        timestamp: new Date().toISOString(),
        pending: true
      });

      setMessage('');
      toast({
        title: "Command Sent",
        description: "ESP-NOW command has been sent successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send ESP-NOW command.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const SetEspnowMode = async (mode) => {
    setLoading(true);
    try {
      const commandRef = ref(db, 'Tracker/commands');
      await set(commandRef, {
        command: 'mode_espnow',
        data1: mode,
        data2: ' ',
        timestamp: new Date().toISOString(),
        pending: true
      });

      toast({
        title: "Mode Set",
        description: `ESP-NOW mode set to ${EspnowModes[mode].name}.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to set ESP-NOW mode.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const SetBootEspnowMode = async (mode) => {
    setLoading(true);
    try {
      const configRef = ref(db, 'Tracker/deviceconfig');
      await update(configRef, {
        espnow_boot_m: mode,
        timestamp: new Date().toISOString()
      });

      const commandRef = ref(db, 'Tracker/commands');
      await set(commandRef, {
        command: 'set_config',
        data1: ' ',
        data2: ' ',
        timestamp: new Date().toISOString(),
        pending: true
      });

      toast({
        title: "Boot Mode Saved",
        description: "ESP-NOW boot mode has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save boot mode.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const EspnowModes = [
    { value: 0, name: 'OFF' },
    { value: 1, name: 'Normal' },
    { value: 2, name: 'Long Range' }
  ];

  const getModeColor = (mode) => {
    switch(mode) {
      case 0: return 'bg-gray-600';
      case 1: return 'bg-green-600';
      case 2: return 'bg-blue-600';
      default: return 'bg-gray-600';
    }
  };

  const getModeText = (mode) => {
    if (mode === 0) return 'Inactive';
    return `${EspnowModes[mode].name} Active`;
  };

  return (
    <div className="p-6 pt-8 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">ESP-NOW</h1>
          <Badge className={`${getModeColor(currentMode)} text-white`}>
            {getModeText(currentMode)}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Set ESP-NOW Mode */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Radio className="w-5 h-5 mr-2 text-cyan-400" />
              Set ESP-NOW Mode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {EspnowModes.map((mode) => (
                <Button
                  key={mode.value}
                  variant={currentMode === mode.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => SetEspnowMode(mode.value)}
                  disabled={loading}
                  className={currentMode === mode.value 
                    ? "bg-blue-600 hover:bg-blue-700" 
                    : "border-gray-600 text-gray-300 hover:bg-gray-700"
                  }
                >
                  {mode.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Set ESP-NOW Boot Mode */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Radio className="w-5 h-5 mr-2 text-purple-400" />
              Set ESP-NOW Boot Mode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {EspnowModes.map((mode) => (
                <Button
                  key={mode.value}
                  variant={bootMode === mode.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => SetBootEspnowMode(mode.value)}
                  disabled={loading}
                  className={bootMode === mode.value 
                    ? "bg-blue-600 hover:bg-blue-700" 
                    : "border-gray-600 text-gray-300 hover:bg-gray-700"
                  }
                >
                  {mode.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Terminal */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Terminal className="w-5 h-5 mr-2 text-green-400" />
            ESP-NOW Terminal
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Messages Display */}
          <div className="h-96 overflow-y-auto p-4 space-y-3 bg-black/30 font-mono text-sm">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No command history yet
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.type === 'sent' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      msg.type === 'sent'
                        ? 'bg-blue-600/30 border border-blue-500/50 text-blue-100'
                        : 'bg-green-600/30 border border-green-500/50 text-green-100'
                    }`}
                  >
                    <div className="break-words">{msg.msg}</div>
                    <div className={`text-xs mt-1 ${
                      msg.type === 'sent' ? 'text-blue-400' : 'text-green-400'
                    }`}>
                      {getTimeAgo(msg.timestamp)}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Command Input */}
          <div className="p-4 border-t border-gray-700">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !loading) {
                    SendEspnowCmd(message);
                  }
                }}
                placeholder="Enter command..."
                className="flex-1 bg-gray-700 border-gray-600 text-white placeholder-gray-500 font-mono"
                disabled={loading}
              />
              <Button
                onClick={() => SendEspnowCmd(message)}
                disabled={loading || !message.trim()}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EspNowTab;