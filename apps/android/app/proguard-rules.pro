# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class **.*$serializer { *; }
-keep,includedescriptorclasses class com.mastimalai.ott.**$$serializer { *; }
-keepclassmembers class com.mastimalai.ott.** {
    *** Companion;
}
-keepclasseswithmembers class com.mastimalai.ott.** {
    kotlinx.serialization.KSerializer serializer(...);
}
