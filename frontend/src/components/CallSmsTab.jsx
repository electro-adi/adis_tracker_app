import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Phone, MessageSquare, Send, PhoneCall, History } from 'lucide-react';
import { mockApi, mockSmsHistory, mockContacts } from '../utils/mock';
import { useToast } from '../hooks/use-toast';

const CallSmsTab = () => {
  const [callNumber, setCallNumber] = useState('');
  const [smsNumber, setSmsNumber] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [smsHistory] = useState(mockSmsHistory);
  const [contacts] = useState(mockContacts);
  const [loading, setLoading] = useState({ call: false, sms: false });
  const { toast } = useToast();

  const makeCall = async () => {
    if (!callNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter a phone number",
        variant: "destructive",
      });
      return;
    }

    setLoading(prev => ({ ...prev, call: true }));
    try {
      await mockApi.makeCall(callNumber);
      toast({
        title: "Call Initiated",
        description: `Calling ${callNumber}...`,
      });
      setCallNumber('');
    } catch (error) {
      toast({
        title: "Call Failed",
        description: "Unable to initiate call",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, call: false }));
    }
  };

  const sendSms = async () => {
    if (!smsNumber.trim() || !smsMessage.trim()) {
      toast({
        title: "Error",
        description: "Please enter both phone number and message",
        variant: "destructive",
      });
      return;
    }

    setLoading(prev => ({ ...prev, sms: true }));
    try {
      await mockApi.sendSms({ number: smsNumber, sms: smsMessage });
      toast({
        title: "SMS Sent",
        description: `Message sent to ${smsNumber}`,
      });
      setSmsNumber('');
      setSmsMessage('');
    } catch (error) {
      toast({
        title: "SMS Failed",
        description: "Unable to send message",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, sms: false }));
    }
  };

  const selectContact = (number, type) => {
    if (type === 'call') {
      setCallNumber(number);
    } else {
      setSmsNumber(number);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Call & SMS Control</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Call Section */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Phone className="w-5 h-5 mr-2 text-green-400" />
              Make Call
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Phone Number</label>
              <Input
                value={callNumber}
                onChange={(e) => setCallNumber(e.target.value)}
                placeholder="Enter phone number"
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              />
            </div>
            
            <Button 
              onClick={makeCall}
              disabled={loading.call}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {loading.call ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Calling...
                </>
              ) : (
                <>
                  <PhoneCall className="w-4 h-4 mr-2" />
                  Make Call
                </>
              )}
            </Button>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Quick Contacts</label>
              <div className="flex flex-wrap gap-2">
                {contacts.map((contact) => (
                  <Button
                    key={contact.id}
                    variant="outline"
                    size="sm"
                    onClick={() => selectContact(contact.number, 'call')}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    {contact.name}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SMS Section */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <MessageSquare className="w-5 h-5 mr-2 text-blue-400" />
              Send SMS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Phone Number</label>
              <Input
                value={smsNumber}
                onChange={(e) => setSmsNumber(e.target.value)}
                placeholder="Enter phone number"
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Message</label>
              <Textarea
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                placeholder="Enter your message"
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 resize-none"
                rows={3}
              />
              <div className="text-xs text-gray-500 text-right">
                {smsMessage.length}/160 characters
              </div>
            </div>

            <Button 
              onClick={sendSms}
              disabled={loading.sms}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading.sms ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send SMS
                </>
              )}
            </Button>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Quick Contacts</label>
              <div className="flex flex-wrap gap-2">
                {contacts.map((contact) => (
                  <Button
                    key={contact.id}
                    variant="outline"
                    size="sm"
                    onClick={() => selectContact(contact.number, 'sms')}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    {contact.name}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SMS History */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <History className="w-5 h-5 mr-2 text-purple-400" />
            Recent SMS Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {smsHistory.map((sms) => (
              <div key={sms.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge 
                      variant={sms.type === 'sent' ? 'default' : 'secondary'}
                      className={sms.type === 'sent' ? 'bg-green-600' : 'bg-blue-600'}
                    >
                      {sms.type.toUpperCase()}
                    </Badge>
                    <span className="text-gray-300 font-mono text-sm">{sms.number}</span>
                  </div>
                  <p className="text-white text-sm">{sms.message}</p>
                  <p className="text-gray-400 text-xs mt-1">{sms.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CallSmsTab;