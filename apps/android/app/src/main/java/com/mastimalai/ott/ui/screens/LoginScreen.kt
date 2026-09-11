package com.mastimalai.ott.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mastimalai.ott.di.ServiceLocator
import com.mastimalai.ott.ui.theme.Accent
import com.mastimalai.ott.ui.theme.Muted
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(onLoggedIn: () -> Unit) {
    val repo = ServiceLocator.repository
    val scope = rememberCoroutineScope()

    var step by remember { mutableStateOf("mobile") }
    var mobile by remember { mutableStateOf("") }
    var otp by remember { mutableStateOf("") }
    var devOtp by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Masti Malai", color = Accent, fontSize = 30.sp, fontWeight = FontWeight.Black)
        Text("Entertainment Ka Full Tadka", color = Muted, fontSize = 13.sp)

        if (step == "mobile") {
            OutlinedTextField(
                value = mobile,
                onValueChange = { mobile = it },
                label = { Text("Mobile number") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(top = 24.dp),
            )
            Button(
                onClick = {
                    error = null; busy = true
                    scope.launch {
                        try {
                            devOtp = repo.sendOtp(mobile)
                            devOtp?.let { otp = it }
                            step = "otp"
                        } catch (e: Exception) {
                            error = e.message ?: "Could not send OTP"
                        } finally { busy = false }
                    }
                },
                enabled = !busy && mobile.length >= 10,
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            ) { Text(if (busy) "Sending…" else "Send OTP") }
        } else {
            devOtp?.let {
                Text("Dev OTP: $it (auto-filled)", color = Accent, fontSize = 12.sp,
                    modifier = Modifier.padding(top = 16.dp))
            }
            OutlinedTextField(
                value = otp,
                onValueChange = { otp = it },
                label = { Text("6-digit OTP") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            )
            Button(
                onClick = {
                    error = null; busy = true
                    scope.launch {
                        try {
                            repo.verifyOtp(mobile, otp)
                            onLoggedIn()
                        } catch (e: Exception) {
                            error = e.message ?: "Invalid OTP"
                        } finally { busy = false }
                    }
                },
                enabled = !busy && otp.length == 6,
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            ) { Text(if (busy) "Verifying…" else "Verify & Login") }
            TextButton(onClick = { step = "mobile" }) { Text("Change number", color = Muted) }
        }

        error?.let { Text(it, color = androidx.compose.ui.graphics.Color.Red, modifier = Modifier.padding(top = 12.dp)) }
    }
}
