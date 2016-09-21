var gulp = require('gulp'),
    rename = require('gulp-rename'),
    purify = require('gulp-purifycss'),
    del = require('del'),
    cleanCSS = require('gulp-clean-css');

gulp.task('default', function() {

});

gulp.task('minify-css', function() {

  del( ['public/css/*'] );

  return gulp.src('styles/*.css')
    .pipe(purify(['views/layouts/*.handlebars','views/*.handlebars']))
    .pipe(cleanCSS({compatibility: 'ie8'}))
    .pipe(rename({ suffix: '.min' }))
    .pipe(gulp.dest('public/css'));

});

gulp.task('watch', function () {
    gulp.watch('styles/*.css', ['minify-css']);
});
