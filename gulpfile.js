var gulp = require('gulp'),
    rename = require('gulp-rename'),
    purify = require('gulp-purifycss'),
    del = require('del'),
    cleanCSS = require('gulp-clean-css'),
    concat = require('gulp-concat');

gulp.task('default', function() {

});

gulp.task('minify-css', function() {

  del( ['public/css/*'] );

  del( ['styles/main.css'] );

  return gulp.src('styles/*.css')
    .pipe(concat('main.css'))
    .pipe(purify(['views/layouts/*.handlebars','views/*.handlebars']))
    .pipe(cleanCSS({compatibility: 'ie8'}))
    .pipe(rename({ suffix: '.min' }))
    .pipe(gulp.dest('public/css'));

});

gulp.task('save-js', function() {

    del( ['public/js/*'] );

    return gulp.src('scripts/*.js')
        .pipe(gulp.dest('public/js'));

})

gulp.task('watch', function () {
    gulp.watch('styles/*.css', ['minify-css']);
});
