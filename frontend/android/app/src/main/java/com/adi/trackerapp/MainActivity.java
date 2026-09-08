package com.adi.trackerapp;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannels();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);

            NotificationChannel statusUpdate = new NotificationChannel(
                "status_update",
                "Status Update",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            statusUpdate.setDescription("General status update notifications");

            NotificationChannel locationUpdate = new NotificationChannel(
                "location_update",
                "Location Update",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            locationUpdate.setDescription("General location update notifications");

            NotificationChannel general = new NotificationChannel(
                "general",
                "General",
                NotificationManager.IMPORTANCE_LOW
            );
            general.setDescription("General notifications");

            NotificationChannel warnings = new NotificationChannel(
                "warnings",
                "Warnings",
                NotificationManager.IMPORTANCE_HIGH
            );
            warnings.setDescription("Warnings or alerts");

            NotificationChannel high = new NotificationChannel(
                "high_priority",
                "High Priority",
                NotificationManager.IMPORTANCE_MAX
            );
            high.setDescription("Critical or urgent alerts");

            manager.createNotificationChannel(statusUpdate);
            manager.createNotificationChannel(locationUpdate);
            manager.createNotificationChannel(general);
            manager.createNotificationChannel(warnings);
            manager.createNotificationChannel(high);
        }
    }
}
