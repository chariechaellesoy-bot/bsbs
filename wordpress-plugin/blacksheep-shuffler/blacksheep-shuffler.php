<?php
/**
 * Plugin Name: BlackSheep Shuffler
 * Plugin URI: https://github.com/chariechaellesoy-bot/bsbs
 * Description: WordPress plugin version of the BlackSheep Shuffler badminton app.
 * Version: 6.1.1
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

/**
 * Enqueue frontend assets.
 */
function bsbs_enqueue_assets() {
wp_enqueue_style( 'bsbs-google-font', 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap', array(), null );
wp_enqueue_style( 'bsbs-app-style', BSBS_PLUGIN_URL . 'assets/badminton-shuffler.css', array( 'bsbs-google-font' ), '6.1.1' );
wp_enqueue_script( 'bsbs-app-script', BSBS_PLUGIN_URL . 'assets/badminton-shuffler.js', array(), '6.1.1', true );
}

/**
 * Render app via shortcode.
 *
 * @return string
 */
function bsbs_render_shortcode() {
bsbs_enqueue_assets();

$asset_url = trailingslashit( BSBS_PLUGIN_URL . 'assets' );

ob_start();
include BSBS_PLUGIN_PATH . 'templates/app-template.php';

return ob_get_clean() ?: '';
}

add_shortcode( 'blacksheep_shuffler', 'bsbs_render_shortcode' );
add_shortcode( 'bsbs', 'bsbs_render_shortcode' );
