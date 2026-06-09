<?php
/**
 * Plugin Name: BlackSheep Shuffler
 * Plugin URI: https://github.com/chariechaellesoy-bot/bsbs
 * Description: WordPress plugin version of the BlackSheep Shuffler badminton app.
 * Version: 6.5.0
 * Author: BlackSheep
 * License: GPL-2.0-or-later
 * Text Domain: blacksheep-shuffler
 */

if ( ! defined( 'ABSPATH' ) ) {
exit;
}

if ( ! defined( 'BSBS_PLUGIN_FILE' ) ) {
define( 'BSBS_PLUGIN_FILE', __FILE__ );
}

if ( ! defined( 'BSBS_PLUGIN_URL' ) ) {
define( 'BSBS_PLUGIN_URL', plugin_dir_url( BSBS_PLUGIN_FILE ) );
}

if ( ! defined( 'BSBS_PLUGIN_PATH' ) ) {
define( 'BSBS_PLUGIN_PATH', plugin_dir_path( BSBS_PLUGIN_FILE ) );
}

if ( ! defined( 'BSBS_PLUGIN_VERSION' ) ) {
define( 'BSBS_PLUGIN_VERSION', '6.5.0' );
}

/**
 * Enqueue frontend assets.
 */
function bsbs_enqueue_assets() {
wp_enqueue_style( 'bsbs-google-font', 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap', array(), null );

$style_path    = BSBS_PLUGIN_PATH . 'assets/badminton-shuffler.css';
$script_path   = BSBS_PLUGIN_PATH . 'assets/badminton-shuffler.js';
$style_version = file_exists( $style_path ) ? (string) filemtime( $style_path ) : BSBS_PLUGIN_VERSION;
$script_version = file_exists( $script_path ) ? (string) filemtime( $script_path ) : BSBS_PLUGIN_VERSION;

wp_enqueue_style( 'bsbs-app-style', BSBS_PLUGIN_URL . 'assets/badminton-shuffler.css', array( 'bsbs-google-font' ), $style_version );
wp_enqueue_script( 'bsbs-app-script', BSBS_PLUGIN_URL . 'assets/badminton-shuffler.js', array(), $script_version, true );
wp_add_inline_script( 'bsbs-app-script', 'window.BSBS_APP_VERSION = ' . wp_json_encode( BSBS_PLUGIN_VERSION ) . ';', 'before' );
}

/**
 * Render app via shortcode.
 *
 * @return string
 */
function bsbs_render_shortcode() {
bsbs_enqueue_assets();

$asset_url      = trailingslashit( BSBS_PLUGIN_URL . 'assets' );
$plugin_version = BSBS_PLUGIN_VERSION;

ob_start();
include BSBS_PLUGIN_PATH . 'templates/app-template.php';

return ob_get_clean() ?: '';
}

add_shortcode( 'blacksheep_shuffler', 'bsbs_render_shortcode' );
add_shortcode( 'bsbs', 'bsbs_render_shortcode' );
