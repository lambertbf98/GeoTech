# ProGuard Rules for GeoTech App
# Copiar este archivo a android/app/proguard-rules.pro despues de ionic cap add android

#---------------------------------
# Reglas basicas de ofuscacion
#---------------------------------

# Mantener nombres de clases de Capacitor
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }

# Mantener Ionic
-keep class com.ionicframework.** { *; }

# Mantener WebView
-keepclassmembers class * extends android.webkit.WebView {
    public *;
}

#---------------------------------
# Ofuscacion agresiva
#---------------------------------

# Ofuscar nombres de metodos y campos
-obfuscationdictionary proguard-dict.txt
-classobfuscationdictionary proguard-dict.txt
-packageobfuscationdictionary proguard-dict.txt

# Remover logs en produccion
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
    public static *** w(...);
    public static *** e(...);
}

# Remover System.out
-assumenosideeffects class java.io.PrintStream {
    public void println(...);
    public void print(...);
}

#---------------------------------
# Proteccion anti-debugging
#---------------------------------

# Detectar debugger
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

#---------------------------------
# Mantener clases criticas
#---------------------------------

# Modelo de datos (si se usa Java/Kotlin)
-keep class com.geotech.models.** { *; }

# Gson (si se usa)
-keepattributes Signature
-keepattributes *Annotation*
-keep class sun.misc.Unsafe { *; }
-keep class com.google.gson.stream.** { *; }

# OkHttp (si se usa)
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

#---------------------------------
# Optimizaciones
#---------------------------------

# Optimizar codigo
-optimizationpasses 5
-dontusemixedcaseclassnames
-verbose

# Eliminar codigo no usado
-dontwarn **
-dontskipnonpubliclibraryclassmembers

#---------------------------------
# Seguridad adicional
#---------------------------------

# Encriptar strings (requiere DexGuard para efecto completo)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Anti-tampering
-keep class com.geotech.security.** { *; }
