import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { 
  Phone, 
  MessageSquare, 
  Send, 
  PhoneCall, 
  History, 
  UserPlus, 
  Edit, 
  Trash2,
  Users
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PhoneTab = () => {
  const [callNumber, setCallNumber] = useState('');
  const [smsNumber, setSmsNumber] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [smsHistory, setSmsHistory] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState({ call: false, sms: false });
  const [showAddContact, setShowAddContact] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [newContact, setNewContact] = useState({ name: '', number: '' });
  const { toast } = useToast();

  // Load contacts and SMS history
  useEffect(() => {
    loadContacts();
    loadSmsHistory();
  }, []);

  const loadContacts = async () => {
    try {
      const response = await fetch(`${API}/contacts`);
      if (response.ok) {
        const data = await response.json();
        setContacts(data);
      }
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  };

  const loadSmsHistory = async () => {
    try {
      const response = await fetch(`${API}/sms/history`);
      if (response.ok) {
        const data = await response.json();
        setSmsHistory(data);
      }
    } catch (error) {
      console.error('Failed to load SMS history:', error);
    }
  };

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
      const response = await fetch(`${API}/device/call/${encodeURIComponent(callNumber)}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        toast({
          title: "Call Initiated",
          description: `Calling ${callNumber}...`,
        });
        setCallNumber('');
      } else {
        throw new Error('Failed to initiate call');
      }
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
      const response = await fetch(`${API}/device/sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: smsNumber,
          sms: smsMessage
        })
      });

      if (response.ok) {
        toast({
          title: "SMS Sent",
          description: `Message sent to ${smsNumber}`,
        });
        setSmsNumber('');
        setSmsMessage('');
        loadSmsHistory(); // Reload SMS history
      } else {
        throw new Error('Failed to send SMS');
      }
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

  const saveContact = async () => {
    if (!newContact.name.trim() || !newContact.number.trim()) {
      toast({
        title: "Error",
        description: "Please enter both name and number",
        variant: "destructive",
      });
      return;
    }

    try {
      const url = editingContact 
        ? `${API}/contacts/${editingContact.id}`
        : `${API}/contacts`;
      
      const method = editingContact ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newContact)
      });

      if (response.ok) {
        toast({
          title: editingContact ? "Contact Updated" : "Contact Added",
          description: `${newContact.name} has been ${editingContact ? 'updated' : 'saved'} successfully.`,
        });
        setNewContact({ name: '', number: '' });
        setEditingContact(null);
        setShowAddContact(false);
        loadContacts(); // Reload contacts
      } else {
        throw new Error(`Failed to ${editingContact ? 'update' : 'save'} contact`);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Unable to ${editingContact ? 'update' : 'save'} contact`,
        variant: "destructive",
      });
    }
  };

  const editContact = (contact) => {
    setEditingContact(contact);
    setNewContact({ name: contact.name, number: contact.number });
    setShowAddContact(true);
  };

  const deleteContact = async (contactId) => {
    try {
      const response = await fetch(`${API}/contacts/${contactId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: "Contact Deleted",
          description: "Contact has been removed successfully.",
        });
        loadContacts(); // Reload contacts
      } else {
        throw new Error('Failed to delete contact');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Unable to delete contact",
        variant: "destructive",
      });
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Phone Control</h1>
        <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => {
                setEditingContact(null);
                setNewContact({ name: '', number: '' });
              }}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-800 border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-white">
                {editingContact ? 'Edit Contact' : 'Add New Contact'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Name</label>
                <Input
                  value={newContact.name}
                  onChange={(e) => setNewContact(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter contact name"
                  className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Phone Number</label>
                <Input
                  value={newContact.number}
                  onChange={(e) => setNewContact(prev => ({ ...prev, number: e.target.value }))}
                  placeholder="Enter phone number"
                  className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={saveContact} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  {editingContact ? 'Update Contact' : 'Save Contact'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowAddContact(false)}
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
                {contacts.slice(0, 6).map((contact) => (
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
                {contacts.slice(0, 6).map((contact) => (
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

      {/* Contacts Management */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Users className="w-5 h-5 mr-2 text-purple-400" />
            Saved Contacts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contacts.map((contact) => (
              <div key={contact.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <div className="flex-1">
                  <p className="text-white font-medium">{contact.name}</p>
                  <p className="text-gray-400 text-sm font-mono">{contact.number}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => editContact(contact)}
                    className="border-gray-600 text-gray-300 hover:bg-gray-600"
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteContact(contact.id)}
                    className="border-red-600 text-red-300 hover:bg-red-900"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
            
            {contacts.length === 0 && (
              <div className="col-span-full text-center py-8">
                <p className="text-gray-400">No contacts saved yet</p>
                <p className="text-gray-500 text-sm">Click "Add Contact" to get started</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* SMS History */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <History className="w-5 h-5 mr-2 text-orange-400" />
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
                  <p className="text-gray-400 text-xs mt-1">{formatTimestamp(sms.timestamp)}</p>
                </div>
              </div>
            ))}
            
            {smsHistory.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-400">No SMS history available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PhoneTab;