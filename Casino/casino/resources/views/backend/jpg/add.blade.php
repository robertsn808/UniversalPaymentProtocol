@extends('backend.layouts.app')

@section('page-title', 'Add JPG')
@section('page-heading', 'Add JPG')

@section('content')

<section class="content-header">
	@include('backend.partials.messages')
</section>

<section class="content">
	<div class="box box-default">
		<form action="{{ route('backend.jpgame.store') }}" method="POST" enctype="multipart/form-data" id="user-form">
			@csrf
			<div class="box-header with-border">
				<h3 class="box-title">Add JPG</h3>
			</div>

			<div class="box-body">
				<div class="row">
					@include('backend.jpg.partials.base', ['edit' => false])
				</div>
			</div>

			<div class="box-footer">
				<button type="submit" class="btn btn-primary">
					Add JPG
				</button>
			</div>
			</form>
	</div>
</section>

@stop