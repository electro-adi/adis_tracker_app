import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  Phone,
  MessageSquare,
  Users,
  Edit,
  Check,
  X,
} from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { ref, onValue, set, update } from 'firebase/database';
import { db } from '../firebase';

const PhoneTab = () => {
  const { toast } = useToast();

  const [contacts, setContacts] = useState([
    { id: 1, name: "", number: "", editing: false },
    { id: 2, name: "", number: "", editing: false },
    { id: 3, name: "", number: "", editing: false },
    { id: 4, name: "", number: "", editing: false },
    { id: 5, name: "", number: "", editing: false },
  ]);

  const [status, setStatus] = useState({
    stored_sms: 0,
  });

  const [sms_message, setSMS] = useState({
    number: "",
    message: "",
    time_sent_human: ""
  });

  const [loading, setLoading] = useState({ call: false, sms: false, contacts: false });
  const [callNumber, setCallNumber] = useState("");
  const [smsNumber, setSmsNumber] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [smsIndex, setSmsIndex] = useState("");
  const [showSMSDialog, setShowSMSDialog] = useState(false);

  const getTimeAgo = (isoString) => {
    if (!isoString) return '--';
    const now = new Date();
    const past = new Date(isoString);
    const diffMs = now - past;
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  };

  useEffect(() => {
    const commandRef = ref(db, 'Tracker/commands');
    set(commandRef, {
      command: 'get_contacts',
      data1: ' ',
      data2: ' ',
      timestamp: new Date().toISOString(),
      pending: true
    });

    const contactsRef = ref(db, 'Tracker/contacts');
    const unsubContacts = onValue(contactsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const updatedContacts = contacts.map((c, idx) => ({
          ...c,
          name: data[`nam${idx + 1}`] || "",
          number: data[`num${idx + 1}`] || "",
        }));
        setContacts(updatedContacts);
      }
    });

    const statusRef = ref(db, 'Tracker/status/latest');
    const unsubStatus = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStatus({
          stored_sms: data.stored_sms || 0,
        });
      }
    });

    return () => {
      unsubContacts();
      unsubStatus();
    };
  }, []);

  const getSMS = async (index) => {
    setLoading((prev) => ({ ...prev, sms: true }));
    try {
      const commandRef = ref(db, 'Tracker/commands');
      await set(commandRef, {
        command: 'get_sms',
        data1: index,
        data2: ' ',
        timestamp: new Date().toISOString(),
        pending: true
      });
      
      const smsRef = ref(db, 'Tracker/storedsms');
      const unsubSMS = onValue(smsRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.index === index) {
          setSMS({
            number: data.number,
            message: data.message,
            time_sent_human: getTimeAgo(data.time_sent),
          });
          setShowSMSDialog(true);
          unsubSMS();
        }
      });
      toast({
        title: "Request Sent",
        description: "SMS retrieval request sent successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send SMS retrieval request.",
        variant: "destructive",
      });
      console.error("Failed to get sms:", error);
    } finally {
      setLoading((prev) => ({ ...prev, sms: false }));
    }
  };

  const validateContacts = () => {
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const hasName = contact.name.trim() !== "";
      const hasNumber = contact.number.trim() !== "";

      if (hasName && !hasNumber) {
        toast({
          title: "Validation Error",
          description: `Contact ${i + 1}: Name provided but phone number is missing.`,
          variant: "destructive",
        });
        return false;
      }

      if (!hasName && hasNumber) {
        toast({
          title: "Validation Error",
          description: `Contact ${i + 1}: Phone number provided but name is missing.`,
          variant: "destructive",
        });
        return false;
      }

      if (hasNumber) {
        const cleanNumber = contact.number.replace(/\s+/g, '');
        if (!/^\d{10}$/.test(cleanNumber)) {
          toast({
            title: "Validation Error",
            description: `Contact ${i + 1}: Phone number must be exactly 10 digits with no letters.`,
            variant: "destructive",
          });
          return false;
        }
      }
    }
    return true;
  };

  const saveContacts = async () => {
    if (!validateContacts()) return;

    setLoading((prev) => ({ ...prev, contacts: true }));
    try {
      const payload = {};
      contacts.forEach((c, idx) => {
        payload[`nam${idx + 1}`] = c.name.trim() || "";
        payload[`num${idx + 1}`] = c.number.trim() || "";
      });

      const contactsRef = ref(db, 'Tracker/contacts');
      await update(contactsRef, payload);

      const commandRef = ref(db, 'Tracker/commands');
      await set(commandRef, {
        command: 'set_contacts',
        data1: ' ',
        data2: ' ',
        timestamp: new Date().toISOString(),
        pending: true
      });

      setContacts((prev) => prev.map((c) => ({ ...c, editing: false })));

      toast({
        title: "Contacts Updated",
        description: "Contacts have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update contacts.",
        variant: "destructive",
      });
    } finally {
      setLoading((prev) => ({ ...prev, contacts: false }));
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

    setLoading((prev) => ({ ...prev, call: true }));
    try {
      const commandRef = ref(db, 'Tracker/commands');
      await set(commandRef, {
        command: 'make_call',
        data1: callNumber,
        data2: ' ',
        timestamp: new Date().toISOString(),
        pending: true
      });

      toast({
        title: "Call Initiated",
        description: `Calling ${callNumber}...`,
      });
      setCallNumber("");
    } catch (error) {
      toast({
        title: "Call Failed",
        description: "Unable to initiate call",
        variant: "destructive",
      });
    } finally {
      setLoading((prev) => ({ ...prev, call: false }));
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

    setLoading((prev) => ({ ...prev, sms: true }));
    try {
      const commandRef = ref(db, 'Tracker/commands');
      await set(commandRef, {
        command: 'send_sms',
        data1: smsNumber,
        data2: smsMessage,
        timestamp: new Date().toISOString(),
        pending: true
      });

      toast({
        title: "SMS Sent",
        description: `Message sent to ${smsNumber}`,
      });
      setSmsNumber("");
      setSmsMessage("");
    } catch (error) {
      toast({
        title: "SMS Failed",
        description: "Unable to send message",
        variant: "destructive",
      });
    } finally {
      setLoading((prev) => ({ ...prev, sms: false }));
    }
  };

  const selectContact = (contact, type) => {
    if (!contact.name || !contact.number) return;
    if (type === "call") setCallNumber(contact.number);
    if (type === "sms") setSmsNumber(contact.number);
  };

  const toggleEdit = (id) => {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, editing: !c.editing } : c
      )
    );
  };

  const cancelEdit = (id) => {
    const contactsRef = ref(db, 'Tracker/contacts');
    onValue(contactsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setContacts((prev) =>
          prev.map((c, idx) =>
            c.id === id
              ? {
                  ...c,
                  name: data[`nam${idx + 1}`] || "",
                  number: data[`num${idx + 1}`] || "",
                  editing: false,
                }
              : c
          )
        );
      }
    }, { onlyOnce: true });
  };

  const updateContactField = (id, field, value) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Phone Control</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contacts Management */}
        <Card className="bg-gray-800 border-gray-700 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Users className="w-5 h-5 mr-2 text-purple-400" />
              Saved Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                >
                  {contact.editing ? (
                    <div className="flex-1 flex gap-2">
                      <Input
                        value={contact.name}
                        onChange={(e) =>
                          updateContactField(contact.id, "name", e.target.value)
                        }
                        className="bg-gray-600 text-white border-gray-500 focus:border-blue-400"
                        placeholder="Enter name"
                      />
                      <Input
                        value={contact.number}
                        onChange={(e) =>
                          updateContactField(contact.id, "number", e.target.value)
                        }
                        className="bg-gray-600 text-white border-gray-500 focus:border-blue-400"
                        placeholder="Enter 10-digit number"
                        maxLength={10}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleEdit(contact.id)}
                        className="border-green-600 text-green-400 hover:bg-green-600 hover:text-white"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => cancelEdit(contact.id)}
                        className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1">
                        <p className="text-white font-medium">
                          {contact.name || <span className="text-gray-500 italic">Empty</span>}
                        </p>
                        <p className="text-gray-400 text-sm font-mono">
                          {contact.number || <span className="text-gray-600 italic">No number</span>}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleEdit(contact.id)}
                        className="border-gray-600 text-gray-300 hover:bg-gray-600 ml-2"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6">
              <Button
                onClick={saveContacts}
                disabled={loading.contacts}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {loading.contacts ? "Saving..." : "Save Contacts"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Call Section */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Phone className="w-5 h-5 mr-2 text-green-400" />
              Make Call
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={callNumber}
              onChange={(e) => setCallNumber(e.target.value)}
              placeholder="Enter phone number"
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            />
            <Button
              onClick={makeCall}
              disabled={loading.call}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {loading.call ? "Calling..." : "Make Call"}
            </Button>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Quick Contacts</label>
              <div className="flex flex-wrap gap-2">
                {contacts.filter(c => c.name && c.number).map((contact) => (
                  <Button
                    key={contact.id}
                    variant="outline"
                    size="sm"
                    onClick={() => selectContact(contact, "call")}
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
            <Input
              value={smsNumber}
              onChange={(e) => setSmsNumber(e.target.value)}
              placeholder="Enter phone number"
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            />
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
            <Button
              onClick={sendSms}
              disabled={loading.sms}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading.sms ? "Sending..." : "Send SMS"}
            </Button>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Quick Contacts</label>
              <div className="flex flex-wrap gap-2">
                {contacts.filter(c => c.name && c.number).map((contact) => (
                  <Button
                    key={contact.id}
                    variant="outline"
                    size="sm"
                    onClick={() => selectContact(contact, "sms")}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    {contact.name}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Retrieve Stored SMS Section */}
        <Card className="bg-gray-800 border-gray-700 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <MessageSquare className="w-5 h-5 mr-2 text-yellow-400" />
              Retrieve Stored SMS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-300">
              Stored SMS Count: <span className="font-mono">{status.stored_sms}</span>
            </p>
            
            <Input
              value={smsIndex}
              onChange={(e) => setSmsIndex(e.target.value)}
              placeholder={`Enter index (1 - ${status.stored_sms})`}
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            />
            
            <Button
              onClick={() => {
                if (Number(smsIndex) > 0 && Number(smsIndex) <= status.stored_sms) {
                  getSMS(smsIndex);
                } else {
                  toast({
                    title: "Invalid Index",
                    description: "Please enter a valid SMS index",
                    variant: "destructive",
                  });
                }
              }}
              disabled={loading.sms}
              className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              {loading.sms ? "Retrieving..." : "Retrieve SMS"}
            </Button>
          </CardContent>
        </Card>
      </div>
      {/* SMS Popup */}
      {showSMSDialog && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-gray-900 rounded-xl shadow-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">SMS Details</h2>
            <div className="space-y-2">
              <p className="text-gray-300"><span className="font-semibold">From:</span> {sms_message.number}</p>
              <p className="text-gray-300"><span className="font-semibold">Time:</span> {sms_message.time_sent_human}</p>
              <div className="p-3 bg-gray-800 rounded-lg text-white whitespace-pre-wrap">
                {sms_message.message}
              </div>
            </div>
            <div className="mt-4 text-right">
              <Button
                onClick={() => setShowSMSDialog(false)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhoneTab;