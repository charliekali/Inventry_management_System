package com.ttrims.driver.views;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.util.AttributeSet;
import android.util.Base64;
import android.view.MotionEvent;
import android.view.View;

import java.io.ByteArrayOutputStream;

/**
 * SignatureView — a custom canvas-based signature pad.
 *
 * Usage:
 *   signatureView.clear();          // Reset
 *   signatureView.isEmpty();        // True if nothing drawn
 *   signatureView.toBase64();       // PNG encoded as Base64 string
 */
public class SignatureView extends View {

    private Path currentPath = new Path();
    private Paint strokePaint;
    private Bitmap bitmap;
    private Canvas bitmapCanvas;
    private boolean hasSignature = false;

    public SignatureView(Context context) {
        super(context);
        init();
    }

    public SignatureView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init();
    }

    public SignatureView(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        init();
    }

    private void init() {
        strokePaint = new Paint();
        strokePaint.setColor(Color.WHITE);
        strokePaint.setAntiAlias(true);
        strokePaint.setStyle(Paint.Style.STROKE);
        strokePaint.setStrokeJoin(Paint.Join.ROUND);
        strokePaint.setStrokeCap(Paint.Cap.ROUND);
        strokePaint.setStrokeWidth(3.5f);

        setLayerType(LAYER_TYPE_SOFTWARE, null);
    }

    @Override
    protected void onSizeChanged(int w, int h, int oldW, int oldH) {
        super.onSizeChanged(w, h, oldW, oldH);
        bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        bitmapCanvas = new Canvas(bitmap);
        bitmapCanvas.drawColor(Color.parseColor("#1a262e3f")); // transparent-ish bg
    }

    @Override
    protected void onDraw(Canvas canvas) {
        if (bitmap != null) canvas.drawBitmap(bitmap, 0, 0, null);
        canvas.drawPath(currentPath, strokePaint);
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        float x = event.getX();
        float y = event.getY();

        switch (event.getAction()) {
            case MotionEvent.ACTION_DOWN:
                currentPath.moveTo(x, y);
                hasSignature = true;
                return true;
            case MotionEvent.ACTION_MOVE:
                currentPath.lineTo(x, y);
                break;
            case MotionEvent.ACTION_UP:
                bitmapCanvas.drawPath(currentPath, strokePaint);
                currentPath.reset();
                break;
            default:
                return false;
        }
        invalidate();
        return true;
    }

    /** Reset the canvas to blank. */
    public void clear() {
        if (bitmap != null) {
            bitmap.eraseColor(Color.parseColor("#1a262e3f"));
        }
        currentPath.reset();
        hasSignature = false;
        invalidate();
    }

    /** True if the user hasn't drawn anything. */
    public boolean isEmpty() {
        return !hasSignature;
    }

    /**
     * Returns a Base64-encoded PNG string suitable for JSON API submission.
     * Returns null if the pad is empty.
     */
    public String toBase64() {
        if (isEmpty() || bitmap == null) return null;
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.PNG, 90, baos);
        return Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
    }

    /** Returns the raw Bitmap for preview purposes. */
    public Bitmap toBitmap() {
        return bitmap;
    }
}
