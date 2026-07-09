package net.nyx.printerservice.print;

import android.os.Parcel;
import android.os.Parcelable;

public class PrintTextFormat implements Parcelable {

    private int textSize = 24;
    private int underline = 0;
    private float textScaleX = 1.0f;
    private float textScaleY = 1.0f;
    private float letterSpacing = 0;
    private int lineSpacing = 0;
    private int topPadding = 0;
    private int leftPadding = 0;
    private int aline = 0;  // 0=left, 1=center, 2=right
    private int style = 0;  // 0=normal, 1=bold, 2=italic, 3=bold+italic
    private int font = 0;

    public PrintTextFormat() {}

    protected PrintTextFormat(Parcel in) {
        textSize = in.readInt();
        underline = in.readInt();
        textScaleX = in.readFloat();
        textScaleY = in.readFloat();
        letterSpacing = in.readFloat();
        lineSpacing = in.readInt();
        topPadding = in.readInt();
        leftPadding = in.readInt();
        aline = in.readInt();
        style = in.readInt();
        font = in.readInt();
    }

    @Override
    public void writeToParcel(Parcel dest, int flags) {
        dest.writeInt(textSize);
        dest.writeInt(underline);
        dest.writeFloat(textScaleX);
        dest.writeFloat(textScaleY);
        dest.writeFloat(letterSpacing);
        dest.writeInt(lineSpacing);
        dest.writeInt(topPadding);
        dest.writeInt(leftPadding);
        dest.writeInt(aline);
        dest.writeInt(style);
        dest.writeInt(font);
    }

    @Override
    public int describeContents() { return 0; }

    public static final Creator<PrintTextFormat> CREATOR = new Creator<PrintTextFormat>() {
        @Override
        public PrintTextFormat createFromParcel(Parcel in) { return new PrintTextFormat(in); }
        @Override
        public PrintTextFormat[] newArray(int size) { return new PrintTextFormat[size]; }
    };

    public int getTextSize() { return textSize; }
    public void setTextSize(int textSize) { this.textSize = textSize; }

    public int getUnderline() { return underline; }
    public void setUnderline(int underline) { this.underline = underline; }

    public float getTextScaleX() { return textScaleX; }
    public void setTextScaleX(float textScaleX) { this.textScaleX = textScaleX; }

    public float getTextScaleY() { return textScaleY; }
    public void setTextScaleY(float textScaleY) { this.textScaleY = textScaleY; }

    public float getLetterSpacing() { return letterSpacing; }
    public void setLetterSpacing(float letterSpacing) { this.letterSpacing = letterSpacing; }

    public int getLineSpacing() { return lineSpacing; }
    public void setLineSpacing(int lineSpacing) { this.lineSpacing = lineSpacing; }

    public int getTopPadding() { return topPadding; }
    public void setTopPadding(int topPadding) { this.topPadding = topPadding; }

    public int getLeftPadding() { return leftPadding; }
    public void setLeftPadding(int leftPadding) { this.leftPadding = leftPadding; }

    public int getAline() { return aline; }
    public void setAline(int aline) { this.aline = aline; }

    public int getStyle() { return style; }
    public void setStyle(int style) { this.style = style; }

    public int getFont() { return font; }
    public void setFont(int font) { this.font = font; }
}