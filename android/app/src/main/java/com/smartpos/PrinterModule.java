package com.smartpos;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.IBinder;
import android.os.RemoteException;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;

import net.nyx.printerservice.print.IPrinterService;
import net.nyx.printerservice.print.PrintTextFormat;

public class PrinterModule extends ReactContextBaseJavaModule {

    private static final String MODULE_NAME = "PrinterModule";
    private static final String PRINTER_SERVICE_PACKAGE = "net.nyx.printerservice";
    private static final String PRINTER_SERVICE_ACTION = "net.nyx.printerservice.print.IPrinterService";

    private IPrinterService printerService;
    private boolean isConnected = false;

    private final ServiceConnection serviceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            printerService = IPrinterService.Stub.asInterface(service);
            isConnected = true;
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            printerService = null;
            isConnected = false;
        }
    };

    public PrinterModule(ReactApplicationContext reactContext) {
        super(reactContext);
        bindPrinterService();
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    private void bindPrinterService() {
        Intent intent = new Intent();
        intent.setPackage(PRINTER_SERVICE_PACKAGE);
        intent.setAction("net.nyx.printerservice.print.IPrinterService");
        boolean bound = getReactApplicationContext().bindService(
                intent,
                serviceConnection,
                Context.BIND_AUTO_CREATE);
        android.util.Log.d("PrinterModule", "bindService result: " + bound);

        // Also try without action
        if (!bound) {
            Intent intent2 = new Intent();
            intent2.setPackage(PRINTER_SERVICE_PACKAGE);
            getReactApplicationContext().bindService(
                    intent2,
                    serviceConnection,
                    Context.BIND_AUTO_CREATE);
        }
    }

    private PrintTextFormat buildTextFormat(ReadableMap options) {
        PrintTextFormat format = new PrintTextFormat();
        if (options != null) {
            if (options.hasKey("textSize"))
                format.setTextSize(options.getInt("textSize"));
            if (options.hasKey("align"))
                format.setAline(options.getInt("align"));
            if (options.hasKey("style"))
                format.setStyle(options.getInt("style"));
            if (options.hasKey("lineSpacing"))
                format.setLineSpacing(options.getInt("lineSpacing"));
            if (options.hasKey("topPadding"))
                format.setTopPadding(options.getInt("topPadding"));
        }
        return format;
    }

    @ReactMethod
    public void printText(String text, ReadableMap options, Promise promise) {
        if (!isConnected || printerService == null) {
            // retry binding
            bindPrinterService();
            promise.reject("PRINTER_NOT_CONNECTED", "Printer service not connected, retrying...");
            return;
        }
        try {
            PrintTextFormat format = buildTextFormat(options);
            int result = printerService.printText(text, format);
            promise.resolve(result);
        } catch (RemoteException e) {
            promise.reject("PRINT_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void printBarcode(String content, int width, int height, Promise promise) {
        if (!isConnected || printerService == null) {
            promise.reject("PRINTER_NOT_CONNECTED", "Printer service not connected");
            return;
        }
        try {
            // textPosition=2 (below), align=1 (center)
            int result = printerService.printBarcode(content, width, height, 2, 1);
            promise.resolve(result);
        } catch (RemoteException e) {
            promise.reject("PRINT_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void paperOut(int px, Promise promise) {
        if (!isConnected || printerService == null) {
            promise.reject("PRINTER_NOT_CONNECTED", "Printer service not connected");
            return;
        }
        try {
            int result = printerService.paperOut(px);
            promise.resolve(result);
        } catch (RemoteException e) {
            promise.reject("PRINT_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getPrinterStatus(Promise promise) {
        if (!isConnected || printerService == null) {
            promise.reject("PRINTER_NOT_CONNECTED", "Printer service not connected");
            return;
        }
        try {
            int status = printerService.getPrinterStatus();
            promise.resolve(status);
        } catch (RemoteException e) {
            promise.reject("PRINT_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void isConnected(Promise promise) {
        promise.resolve(isConnected);
    }

    @Override
    public void onCatalystInstanceDestroy() {
        try {
            getReactApplicationContext().unbindService(serviceConnection);
        } catch (Exception ignored) {
        }
    }
}