/*
 * This file is auto-generated from IPrinterService.aidl
 * Manually generated to resolve build issue with react-native-nyx-printer
 * Package: net.nyx.printerservice.print
 */
package net.nyx.printerservice.print;

import android.graphics.Bitmap;
import android.os.Binder;
import android.os.IBinder;
import android.os.IInterface;
import android.os.Parcel;
import android.os.RemoteException;

public interface IPrinterService extends IInterface {

    String DESCRIPTOR = "net.nyx.printerservice.print.IPrinterService";

    String getServiceVersion() throws RemoteException;

    int getPrinterVersion(String[] ver) throws RemoteException;

    int getPrinterModel(String[] model) throws RemoteException;

    int getPrinterStatus() throws RemoteException;

    int paperOut(int px) throws RemoteException;

    int paperBack(int px) throws RemoteException;

    int printText(String text, PrintTextFormat textFormat) throws RemoteException;

    int printText2(String text, PrintTextFormat textFormat, int textWidth, int align) throws RemoteException;

    int printBarcode(String content, int width, int height, int textPosition, int align) throws RemoteException;

    int printQrCode(String content, int width, int height, int align) throws RemoteException;

    int printBitmap(Bitmap bitmap, int type, int align) throws RemoteException;

    int labelLocate(int labelHeight, int labelGap) throws RemoteException;

    int labelPrintEnd() throws RemoteException;

    int labelLocateAuto() throws RemoteException;

    int labelDetectAuto() throws RemoteException;

    boolean hasLabelLearning() throws RemoteException;

    int clearLabelLearning() throws RemoteException;

    abstract class Stub extends Binder implements IPrinterService {

        public Stub() {
            attachInterface(this, DESCRIPTOR);
        }

        public static IPrinterService asInterface(IBinder obj) {
            if (obj == null)
                return null;
            IInterface iin = obj.queryLocalInterface(DESCRIPTOR);
            if (iin instanceof IPrinterService)
                return (IPrinterService) iin;
            return new Proxy(obj);
        }

        @Override
        public IBinder asBinder() {
            return this;
        }

        @Override
        public boolean onTransact(int code, Parcel data, Parcel reply, int flags) throws RemoteException {
            return super.onTransact(code, data, reply, flags);
        }

        private static class Proxy implements IPrinterService {
            private final IBinder mRemote;

            Proxy(IBinder remote) {
                mRemote = remote;
            }

            @Override
            public IBinder asBinder() {
                return mRemote;
            }

            @Override
            public String getServiceVersion() throws RemoteException {
                Parcel data = Parcel.obtain();
                Parcel reply = Parcel.obtain();
                try {
                    data.writeInterfaceToken(DESCRIPTOR);
                    mRemote.transact(1, data, reply, 0);
                    reply.readException();
                    return reply.readString();
                } finally {
                    data.recycle();
                    reply.recycle();
                }
            }

            @Override
            public int getPrinterVersion(String[] ver) throws RemoteException {
                Parcel data = Parcel.obtain();
                Parcel reply = Parcel.obtain();
                try {
                    data.writeInterfaceToken(DESCRIPTOR);
                    mRemote.transact(2, data, reply, 0);
                    reply.readException();
                    reply.readStringArray(ver);
                    return reply.readInt();
                } finally {
                    data.recycle();
                    reply.recycle();
                }
            }

            @Override
            public int getPrinterModel(String[] model) throws RemoteException {
                Parcel data = Parcel.obtain();
                Parcel reply = Parcel.obtain();
                try {
                    data.writeInterfaceToken(DESCRIPTOR);
                    mRemote.transact(3, data, reply, 0);
                    reply.readException();
                    reply.readStringArray(model);
                    return reply.readInt();
                } finally {
                    data.recycle();
                    reply.recycle();
                }
            }

            @Override
            public int getPrinterStatus() throws RemoteException {
                Parcel data = Parcel.obtain();
                Parcel reply = Parcel.obtain();
                try {
                    data.writeInterfaceToken(DESCRIPTOR);
                    mRemote.transact(4, data, reply, 0);
                    reply.readException();
                    return reply.readInt();
                } finally {
                    data.recycle();
                    reply.recycle();
                }
            }

            @Override
            public int paperOut(int px) throws RemoteException {
                Parcel data = Parcel.obtain();
                Parcel reply = Parcel.obtain();
                try {
                    data.writeInterfaceToken(DESCRIPTOR);
                    data.writeInt(px);
                    mRemote.transact(5, data, reply, 0);
                    reply.readException();
                    return reply.readInt();
                } finally {
                    data.recycle();
                    reply.recycle();
                }
            }

            @Override
            public int paperBack(int px) throws RemoteException {
                Parcel data = Parcel.obtain();
                Parcel reply = Parcel.obtain();
                try {
                    data.writeInterfaceToken(DESCRIPTOR);
                    data.writeInt(px);
                    mRemote.transact(6, data, reply, 0);
                    reply.readException();
                    return reply.readInt();
                } finally {
                    data.recycle();
                    reply.recycle();
                }
            }

            @Override
            public int printText(String text, PrintTextFormat textFormat) throws RemoteException {
                Parcel data = Parcel.obtain();
                Parcel reply = Parcel.obtain();
                try {
                    data.writeInterfaceToken(DESCRIPTOR);
                    data.writeString(text);
                    if (textFormat != null) {
                        data.writeInt(1);
                        textFormat.writeToParcel(data, 0);
                    } else {
                        data.writeInt(0);
                    }
                    mRemote.transact(7, data, reply, 0);
                    reply.readException();
                    return reply.readInt();
                } finally {
                    data.recycle();
                    reply.recycle();
                }
            }

            @Override
            public int printText2(String text, PrintTextFormat textFormat, int textWidth, int align)
                    throws RemoteException {
                Parcel data = Parcel.obtain();
                Parcel reply = Parcel.obtain();
                try {
                    data.writeInterfaceToken(DESCRIPTOR);
                    data.writeString(text);
                    if (textFormat != null) {
                        data.writeInt(1);
                        textFormat.writeToParcel(data, 0);
                    } else {
                        data.writeInt(0);
                    }
                    data.writeInt(textWidth);
                    data.writeInt(align);
                    mRemote.transact(8, data, reply, 0);
                    reply.readException();
                    return reply.readInt();
                } finally {
                    data.recycle();
                    reply.recycle();
                }
            }

            @Override
            public int printBarcode(String content, int width, int height, int textPosition, int align)
                    throws RemoteException {
                Parcel data = Parcel.obtain();
                Parcel reply = Parcel.obtain();
                try {
                    data.writeInterfaceToken(DESCRIPTOR);
                    data.writeString(content);
                    data.writeInt(width);
                    data.writeInt(height);
                    data.writeInt(textPosition);
                    data.writeInt(align);
                    mRemote.transact(9, data, reply, 0);
                    reply.readException();
                    return reply.readInt();
                } finally {
                    data.recycle();
                    reply.recycle();
                }
            }

            @Override
            public int printQrCode(String content, int width, int height, int align) throws RemoteException {
                Parcel data = Parcel.obtain();
                Parcel reply = Parcel.obtain();
                try {
                    data.writeInterfaceToken(DESCRIPTOR);
                    data.writeString(content);
                    data.writeInt(width);
                    data.writeInt(height);
                    data.writeInt(align);
                    mRemote.transact(10, data, reply, 0);
                    reply.readException();
                    return reply.readInt();
                } finally {
                    data.recycle();
                    reply.recycle();
                }
            }

            @Override
            public int printBitmap(Bitmap bitmap, int type, int align) throws RemoteException {
                Parcel data = Parcel.obtain();
                Parcel reply = Parcel.obtain();
                try {
                    data.writeInterfaceToken(DESCRIPTOR);
                    if (bitmap != null) {
                        data.writeInt(1);
                        bitmap.writeToParcel(data, 0);
                    } else {
                        data.writeInt(0);
                    }
                    data.writeInt(type);
                    data.writeInt(align);
                    mRemote.transact(11, data, reply, 0);
                    reply.readException();
                    return reply.readInt();
                } finally {
                    data.recycle();
                    reply.recycle();
                }
            }

            @Override
            public int labelLocate(int labelHeight, int labelGap) throws RemoteException {
                Parcel data = Parcel.obtain();
                Parcel reply = Parcel.obtain();
                try {
                    data.writeInterfaceToken(DESCRIPTOR);
                    data.writeInt(labelHeight);
                    data.writeInt(labelGap);
                    mRemote.transact(12, data, reply, 0);
                    reply.readException();
                    return reply.readInt();
                } finally {
                    data.recycle();
                    reply.recycle();
                }
            }

            @Override
            public int labelPrintEnd() throws RemoteException {
                Parcel data = Parcel.obtain();
                Parcel reply = Parcel.obtain();
                try {
                    data.writeInterfaceToken(DESCRIPTOR);
                    mRemote.transact(13, data, reply, 0);
                    reply.readException();
                    return reply.readInt();
                } finally {
                    data.recycle();
                    reply.recycle();
                }
            }

            @Override
            public int labelLocateAuto() throws RemoteException {
                Parcel data = Parcel.obtain();
                Parcel reply = Parcel.obtain();
                try {
                    data.writeInterfaceToken(DESCRIPTOR);
                    mRemote.transact(14, data, reply, 0);
                    reply.readException();
                    return reply.readInt();
                } finally {
                    data.recycle();
                    reply.recycle();
                }
            }

            @Override
            public int labelDetectAuto() throws RemoteException {
                Parcel data = Parcel.obtain();
                Parcel reply = Parcel.obtain();
                try {
                    data.writeInterfaceToken(DESCRIPTOR);
                    mRemote.transact(15, data, reply, 0);
                    reply.readException();
                    return reply.readInt();
                } finally {
                    data.recycle();
                    reply.recycle();
                }
            }

            @Override
            public boolean hasLabelLearning() throws RemoteException {
                Parcel data = Parcel.obtain();
                Parcel reply = Parcel.obtain();
                try {
                    data.writeInterfaceToken(DESCRIPTOR);
                    mRemote.transact(16, data, reply, 0);
                    reply.readException();
                    return reply.readInt() != 0;
                } finally {
                    data.recycle();
                    reply.recycle();
                }
            }

            @Override
            public int clearLabelLearning() throws RemoteException {
                Parcel data = Parcel.obtain();
                Parcel reply = Parcel.obtain();
                try {
                    data.writeInterfaceToken(DESCRIPTOR);
                    mRemote.transact(17, data, reply, 0);
                    reply.readException();
                    return reply.readInt();
                } finally {
                    data.recycle();
                    reply.recycle();
                }
            }
        }
    }
}